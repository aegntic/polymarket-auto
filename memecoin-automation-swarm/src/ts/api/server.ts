import { Hono } from "hono";
import { serve } from "@hono/node-server";
import "dotenv/config";
import * as redis from "../shared/redis";
import * as ch from "../shared/clickhouse";
import { MasError, ERROR_CODES } from "../shared/types";
import type { Classification, ClassificationResult, TokenObservation } from "../shared/types";

const app = new Hono();

// Health check
app.get("/health", async (c) => {
  const [redisOk, chOk] = await Promise.all([
    redis.getRedis().ping().then(() => true).catch(() => false),
    ch.ping(),
  ]);
  const status = redisOk && chOk ? "healthy" : "degraded";
  return c.json({
    status,
    services: { redis: redisOk, clickhouse: chOk },
    timestamp: new Date().toISOString(),
  });
});

// Classify a token
app.post("/classify", async (c) => {
  const body = await c.req.json<{ token_address: string; chain: string }>();
  if (!body.token_address || !body.chain) {
    return c.json(
      { error: { code: "MAS_E8001", message: "Missing required fields: token_address, chain" } },
      400,
    );
  }

  // Check circuit breaker
  const hourlyKey = `mas:risk:hourly:${new Date().toISOString().slice(0, 13)}`;
  const hourlyCount = await redis.getCounter(hourlyKey);
  if (hourlyCount >= 40) {
    return c.json(
      { error: { code: ERROR_CODES.CB_ORANGE, message: "Circuit breaker: rate limit exceeded" } },
      429,
    );
  }

  // Query recent observations from ClickHouse
  let observations: TokenObservation[] = [];
  try {
    observations = await ch.query<TokenObservation>(
      `SELECT * FROM clonet.token_observations WHERE token_address = '${body.token_address}' AND chain = '${body.chain}' ORDER BY created_at DESC LIMIT 1`,
    );
  } catch {
    // ClickHouse might be empty, continue with empty observations
  }

  // Return classification placeholder (real ML in detect module)
  const result: ClassificationResult = {
    token_address: body.token_address,
    chain: body.chain as import("../shared/types").Chain,
    classification: "unknown" as Classification,
    confidence: 0.0,
    reasoning: observations.length > 0
      ? "Token found in observations, classification pending"
      : "No observation data available",
    classified_at: new Date().toISOString(),
    cost_usd: 0,
  };

  return c.json(result);
});

// Export dataset
app.get("/dataset/export", async (c) => {
  const format = c.req.query("format") || "jsonl";
  const chain = c.req.query("chain") || "all";
  const limit = parseInt(c.req.query("limit") || "1000", 10);

  let chainFilter = "";
  if (chain !== "all") {
    chainFilter = `AND chain = '${chain}'`;
  }

  try {
    const records = await ch.query(
      `SELECT * FROM clonet.classifications WHERE 1=1 ${chainFilter} ORDER BY classified_at DESC LIMIT ${limit}`,
    );

    if (format === "csv") {
      const rows = records as Record<string, unknown>[];
      if (rows.length === 0) return c.text("");
      const headers = Object.keys(rows[0]).join(",");
      const csvRows = rows.map((r) => Object.values(r).join(","));
      return c.text([headers, ...csvRows].join("\n"), 200, {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=clonet-export.csv",
      });
    }

    // Default: JSONL
    const jsonl = (records as Record<string, unknown>[])
      .map((r) => JSON.stringify(r))
      .join("\n");
    return c.text(jsonl, 200, {
      "Content-Type": "application/x-ndjson",
      "Content-Disposition": "attachment; filename=clonet-export.jsonl",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return c.json(
      { error: { code: ERROR_CODES.CLICKHOUSE_QUERY, message: msg } },
      500,
    );
  }
});

// Error handler
app.onError((err, c) => {
  if (err instanceof MasError) {
    return c.json({ error: { code: err.code, message: err.message, fix: err.fix } }, 500);
  }
  return c.json({ error: { code: "MAS_E9999", message: err.message } }, 500);
});

const port = parseInt(process.env.PORT || "8080", 10);
console.log(`MAS API starting on port ${port}`);
serve({ fetch: app.fetch, port });
