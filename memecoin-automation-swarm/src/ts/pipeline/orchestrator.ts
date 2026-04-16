import * as ch from "../shared/clickhouse";
import * as redis from "../shared/redis";
import { OracleClassifier } from "../oracle/classifier";
import {
  fetchLatestTokens,
  pairToObservation,
  quickScreen,
} from "../recon/shared";
import type { TokenObservation } from "../shared/types";
import { EventEnvelope } from "../shared/types";

let isRunning = false;
let timeoutId: NodeJS.Timeout | null | number = null;
let classificationsInProgress = 0;

export async function runReconLoop() {
  if (!isRunning) return;

  console.log("[Pipeline] Running RECON cycle...");
  try {
    const pairs = await fetchLatestTokens();
    const rawObs = await Promise.all(pairs.map(pairToObservation));
    const observations = rawObs.filter((o): o is TokenObservation => o !== null);

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
      }));

      await ch.insertObservations(insertBatch);
      console.log(`[Pipeline] Inserted ${insertBatch.length} observations`);

      const r = redis.getRedis();
      const hourKey = `mas:risk:hourly:${new Date().toISOString().slice(0, 13)}`;
      const dayKey = `mas:risk:daily:${new Date().toISOString().slice(0, 10)}`;
      await r.incrby(hourKey, observations.length);
      await r.incrby(dayKey, observations.length);

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
        await redis.publishEvent("recon:signals", {
          timestamp: Date.now().toString(),
          module: "recon",
          event_type: "token_detected",
          payload: { obs, match: screen.match, similarity: screen.similarity },
        });
      }
    }
  } catch (err) {
    console.error("[Pipeline] RECON error:", err);
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

  redis.subscribeToChannel("recon:signals", async (envelope: EventEnvelope) => {
    if (envelope.event_type !== "token_detected") return;

    try {
      const { obs, match, similarity } = envelope.payload as any;

      classificationsInProgress++;
      try {
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
              ` | Rule-based similarity: ${similarity.toFixed(3)} to "${match}"`,
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
      classificationsInProgress--;
    }
  });
  console.log("[Pipeline] Subscribed to recon:signals");
}

export function startPipeline() {
  if (isRunning) return;
  isRunning = true;
  console.log("[Pipeline] Starting orchestrator...");

  startClassifierSubscriber().catch(console.error);
  runReconLoop().catch(console.error);
}

export function stopPipeline() {
  isRunning = false;
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  console.log("[Pipeline] Stopped orchestrator.");
}

export function getPipelineStatus() {
  return {
    running: isRunning,
    classificationsInProgress,
  };
}
