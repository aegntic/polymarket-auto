import * as ch from "../shared/clickhouse";
import * as redis from "../shared/redis";
import { OracleClassifier } from "../oracle/classifier";
import { NarrativeEngine } from "../viral/narratives";
import { AlphaDiscoveryEngine } from "../recon/insider_graph";
import {
  fetchLatestTokens,
  pairToObservation,
  quickScreen,
} from "../recon/shared";
import type { TokenObservation } from "../shared/types";
import { EventEnvelope, CHANNELS } from "../shared/types";

let isRunning = false;
let timeoutId: NodeJS.Timeout | null | number = null;
let alphaCronId: NodeJS.Timeout | null | number = null;
let classificationsInProgress = 0;
let reconConsecutiveFailures = 0;
let alphaConsecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 10;

export async function triggerAutoDeploy(
  obs: TokenObservation,
): Promise<string | null> {
  try {
    const baseUrl = `http://localhost:${process.env.PORT || "8080"}`;
    const response = await fetch(`${baseUrl}/deploy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: obs.name,
        symbol: obs.symbol,
      }),
    });

    if (!response.ok) {
      console.error(
        `[Pipeline] Auto-deploy failed with status: ${response.status}`,
      );
      return null;
    }

    const json = await response.json();
    return json?.data?.mintAddress ?? null;
  } catch (err) {
    console.error("[Pipeline] Auto-deploy error:", err);
    return null;
  }
}

export async function triggerViralSwarm(
  obs: TokenObservation,
  cloneMintAddress: string,
) {
  try {
    // Import ViralSwarm dynamically or use an existing import if available
    const { ViralSwarm } = await import("../viral/swarm").catch(() => {
      console.error("[Pipeline] viral/swarm module not found.");
      return { ViralSwarm: null };
    });

    if (!ViralSwarm) return;

    const swarm = new ViralSwarm();
    await swarm.triggerSwarm(obs, cloneMintAddress);
  } catch (err) {
    console.error("[Pipeline] Viral swarm error:", err);
  }
}

export async function runAlphaDiscoveryLoop() {
  if (!isRunning) return;
  const alphaEngine = new AlphaDiscoveryEngine();

  try {
    await alphaEngine.runDiscoveryCycle();
    alphaConsecutiveFailures = 0;
  } catch (err) {
    alphaConsecutiveFailures++;
    console.error("[Pipeline] AlphaGraph error:", err);
    if (alphaConsecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.error(
        `[Pipeline] ALERT: AlphaGraph has failed ${alphaConsecutiveFailures} times consecutively. Entering degraded mode.`,
      );
    }
  }

  // Schedule next discovery run (every 10 minutes)
  if (isRunning) {
    alphaCronId = setTimeout(
      () => {
        runAlphaDiscoveryLoop().catch(console.error);
      },
      10 * 60 * 1000,
    );
  }
}

export async function runReconLoop() {
  if (!isRunning) return;

  console.log("[Pipeline] Running RECON cycle...");
  try {
    const pairs = await fetchLatestTokens();
    const rawObs = await Promise.all(pairs.map(pairToObservation));
    const observations = rawObs.filter(
      (o): o is TokenObservation => o !== null,
    );

    if (observations.length > 0) {
      const screened = observations.map((obs) => ({
        obs,
        screen: quickScreen(obs),
      }));

      const now = new Date().toISOString().replace("T", " ").slice(0, 19);
      const insertBatch = observations.map((obs) => ({
        token_address: obs.token_address,
        chain: obs.chain,
        name: obs.name,
        symbol: obs.symbol,
        decimals: obs.decimals,
        supply: obs.supply || "",
        creator_address: obs.creator_address || "",
        deploy_tx: "",
        first_seen_at: obs.created_at || now,
        observed_at: now,
        source: "dexscreener",
        network: "mainnet",
        volume_1h: obs.volume_1h || 0,
        initial_market_cap_usd: obs.initial_market_cap_usd || 0,
        initial_liquidity_sol: obs.initial_liquidity_sol || 0,
        holder_count_1h: obs.holder_count_1h || 0,
        signal_score: obs.signal_score || 0,
      }));

      await ch.insertObservations(insertBatch);
      console.log(`[Pipeline] Inserted ${insertBatch.length} observations`);

      const r = redis.getRedis();
      // Track observations ingested (uncapped -- just data)
      const obsHourKey = `mas:observations:hourly:${new Date().toISOString().slice(0, 13)}`;
      const obsDayKey = `mas:observations:daily:${new Date().toISOString().slice(0, 10)}`;
      await r.incrby(obsHourKey, observations.length);
      await r.incrby(obsDayKey, observations.length);
      await r.expire(obsHourKey, 7200);
      await r.expire(obsDayKey, 172800);

      // Trigger classify for suspicious ones via Redis
      const toClassify = screened
        .filter(
          (s) =>
            s.screen.isClone ||
            (s.obs.volume_1h || 0) > 1000 ||
            s.obs.symbol.length < 6,
        )
        .slice(0, 15);

      for (const { obs, screen } of toClassify) {
        await redis.publishEvent(CHANNELS.RECON_SIGNALS, {
          timestamp: Date.now().toString(),
          module: "recon",
          event_type: "token_detected",
          payload: { obs, match: screen.match, similarity: screen.similarity },
        });
      }
    }
    reconConsecutiveFailures = 0;
  } catch (err) {
    reconConsecutiveFailures++;
    console.error("[Pipeline] RECON error:", err);
    if (reconConsecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.error(
        `[Pipeline] ALERT: RECON has failed ${reconConsecutiveFailures} times consecutively. Entering degraded mode.`,
      );
    }
  }

  // Schedule next run
  if (isRunning) {
    timeoutId = setTimeout(() => {
      runReconLoop().catch(console.error);
    }, 60000);
  }
}

export async function startClassifierSubscriber() {
  const oracle = new OracleClassifier();
  const narrativeEngine = new NarrativeEngine();

  // Listen to both the TS polling recon and the Rust fast-path sniper
  redis.subscribeToChannel(
    CHANNELS.RECON_SIGNALS,
    async (envelope: EventEnvelope) => {
      // Rust fast-path sends "signal_detected", TS polling sends "token_detected"
      if (
        envelope.event_type !== "token_detected" &&
        envelope.event_type !== "signal_detected"
      )
        return;

      try {
        let obs: TokenObservation;
        let match = "";
        let similarity = 0;

        if (envelope.event_type === "signal_detected") {
          // From Rust
          obs = envelope.payload as TokenObservation;
          console.log(`[Pipeline] HOT PATH SIGNAL received for ${obs.symbol}`);

          if (
            (envelope.payload as TokenObservation & { signal_score?: number })
              .signal_score === 99
          ) {
            console.log(
              `[Pipeline] VAMPIRE SHADOW INTERCEPT TRIGGERED FOR ${obs.symbol}! Executing auto-deploy...`,
            );
            const cloneMintAddress = await triggerAutoDeploy(obs);
            if (cloneMintAddress) {
              await triggerViralSwarm(obs, cloneMintAddress);
            }
          }
        } else {
          // From TS
          const payload = envelope.payload as {
            obs: TokenObservation;
            match: string;
            similarity: number;
          };
          obs = payload.obs;
          match = payload.match;
          similarity = payload.similarity;
        }

        classificationsInProgress++;
        try {
          // Calculate Narrative Distance
          const narrativeScore =
            await narrativeEngine.calculateNarrativeDistance(
              obs.name,
              obs.symbol,
            );

          let narrativeReasoning = "";
          if (narrativeScore.match) {
            narrativeReasoning = ` Narrative Distance: ${narrativeScore.distance.toFixed(1)} (Matched: "${narrativeScore.match.content.substring(0, 30)}...")`;
          } else {
            narrativeReasoning = " Narrative Distance: 100 (No match)";
          }

          console.log(`[Pipeline] ${obs.symbol} ${narrativeReasoning}`);

          const result = await oracle.classify(obs);
          console.log(
            `[Pipeline] Classified ${obs.symbol}: ${result.classification} @ ${result.confidence.toFixed(2)}`,
          );

          await ch.insertClassifications([
            {
              token_address: result.token_address,
              chain: result.chain,
              classification: result.classification,
              confidence: result.confidence,
              original_token: match || "",
              reasoning:
                result.reasoning +
                ` | Rule-based similarity: ${similarity.toFixed(3)} to "${match}" | ${narrativeReasoning}`,
              classified_at: new Date()
                .toISOString()
                .replace("T", " ")
                .slice(0, 19),
            },
          ]);
        } finally {
          classificationsInProgress--;
        }
      } catch (err) {
        console.error("[Pipeline] Classification error:", err);
      }
    },
  );
  console.log("[Pipeline] Subscribed to recon:signals");
}

export function startPipeline() {
  if (isRunning) return;
  isRunning = true;
  console.log("[Pipeline] Starting orchestrator...");

  startClassifierSubscriber().catch(console.error);
  runReconLoop().catch(console.error);
  runAlphaDiscoveryLoop().catch(console.error);
}

export function stopPipeline() {
  isRunning = false;
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  if (alphaCronId) {
    clearTimeout(alphaCronId);
    alphaCronId = null;
  }
  console.log("[Pipeline] Stopped orchestrator.");
}

export function getPipelineStatus() {
  return {
    running: isRunning,
    classificationsInProgress,
  };
}
