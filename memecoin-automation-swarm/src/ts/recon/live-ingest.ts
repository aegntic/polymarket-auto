/**
 * RECON Live Ingestion — pulls real token data from DexScreener
 * and classifies through NVIDIA NIM models.
 *
 * Usage: bun run src/ts/recon/live-ingest.ts [--chain solana|base|bnb] [--classify]
 */

import "dotenv/config";
import * as ch from "../shared/clickhouse";
import * as redis from "../shared/redis";
import { OracleClassifier } from "../oracle/classifier";
import { fetchLatestTokens, pairToObservation, quickScreen } from "./shared";
import type { TokenObservation } from "../shared/types";

async function main() {
  const args = process.argv.slice(2);
  const chainFlag = args.find((a) => a.startsWith("--chain="))?.split("=")[1];
  const shouldClassify = args.includes("--classify");

  console.log("=== RECON Live Ingestion ===");
  console.log(`Chain: ${chainFlag || "all"}`);
  console.log(`Classify via NVIDIA: ${shouldClassify}`);

  // 1. Fetch live tokens from DexScreener
  console.log("\nFetching live tokens from DexScreener...");
  const pairs = await fetchLatestTokens(chainFlag);
  console.log(`Found ${pairs.length} live pairs`);

  if (pairs.length === 0) {
    console.log("No tokens found. Exiting.");
    return;
  }

  // 2. Convert to observations and quick-screen for clones
  const rawObs = await Promise.all(pairs.map(pairToObservation));
  const observations = rawObs.filter((o): o is TokenObservation => o !== null);
  const screened = observations.map((obs) => ({
    obs,
    screen: quickScreen(obs),
  }));

  const cloneFlags = screened.filter((s) => s.screen.isClone);
  const originals = screened.filter((s) => !s.screen.isClone);
  console.log(
    `Quick-screen: ${cloneFlags.length} potential clones, ${originals.length} likely originals`,
  );

  // 3. Insert all observations into ClickHouse
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

  try {
    await ch.insertObservations(insertBatch);
    console.log(`Inserted ${insertBatch.length} observations into ClickHouse`);
  } catch (err) {
    console.error("ClickHouse insert failed:", err);
  }

  // 4. Update Redis counters
  const r = redis.getRedis();
  const hourKey = `mas:risk:hourly:${new Date().toISOString().slice(0, 13)}`;
  const dayKey = `mas:risk:daily:${new Date().toISOString().slice(0, 10)}`;
  await r.incrby(hourKey, observations.length);
  await r.incrby(dayKey, observations.length);
  console.log("Updated Redis counters");

  // 5. Classify via NVIDIA NIM (if --classify flag)
  if (shouldClassify) {
    console.log("\nClassifying tokens via NVIDIA NIM...");
    const oracle = new OracleClassifier();
    let classified = 0;

    // Classify tokens that look suspicious (clones) or high-value (high volume)
    const toClassify = screened
      .filter(
        (s) =>
          s.screen.isClone ||
          (s.obs.volume_1h || 0) > 1000 ||
          s.obs.symbol.length < 6,
      )
      .slice(0, 15); // classify up to 15 per run

    for (const { obs, screen } of toClassify) {
      try {
        const result = await oracle.classify(obs);
        console.log(
          `  ${obs.symbol} (${obs.chain}): ${result.classification} @ ${result.confidence.toFixed(2)} [${result.model_used}]`,
        );

        // Persist classification
        await ch.insertClassifications([
          {
            token_address: result.token_address,
            chain: result.chain,
            classification: result.classification,
            confidence: result.confidence,
            original_token: screen.match || "",
            reasoning:
              result.reasoning +
              ` | Rule-based similarity: ${screen.similarity.toFixed(3)} to "${screen.match}"`,
            classified_at: new Date()
              .toISOString()
              .replace("T", " ")
              .slice(0, 19),
          },
        ]);
        classified++;
      } catch (err) {
        console.error(`  Failed to classify ${obs.symbol}:`, err);
      }
    }
    console.log(`Classified ${classified} tokens`);
  }

  // 6. Summary
  console.log("\n=== Ingestion Summary ===");
  console.log(`Tokens ingested: ${observations.length}`);
  console.log(`Potential clones: ${cloneFlags.length}`);
  if (cloneFlags.length > 0) {
    console.log("Top clone matches:");
    for (const { obs, screen } of cloneFlags.slice(0, 5)) {
      console.log(
        `  ${obs.symbol} -> ${screen.match} (${(screen.similarity * 100).toFixed(1)}%)`,
      );
    }
  }
}

main().catch(console.error);
