import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import "dotenv/config";
import * as redis from "../shared/redis";
import * as ch from "../shared/clickhouse";
import { MasError, ERROR_CODES } from "../shared/types";
import type { Classification, ClassificationResult, TokenObservation } from "../shared/types";
import { OracleClassifier } from "../oracle/classifier";

const app = new Hono();

app.use("*", cors());

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get("/health", async (c) => {
  const [redisOk, chOk] = await Promise.all([
    redis.getRedis().ping().then(() => true).catch(() => false),
    ch.ping(),
  ]);
  const status = redisOk && chOk ? "operational" : "degraded";
  return c.json({
    status,
    redis: redisOk ? "connected" : "disconnected",
    clickhouse: chOk ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Signals — recent token observations from ClickHouse
// ---------------------------------------------------------------------------
app.get("/signals", async (c) => {
  const chain = c.req.query("chain");
  const limit = parseInt(c.req.query("limit") || "50", 10);

  let chainFilter = "";
  if (chain && chain !== "all") {
    chainFilter = `AND o.chain = '${chain}'`;
  }

  try {
    // Join observations with classifications to get real scores
    const rows = await ch.query<{
      token_address: string;
      chain: string;
      name: string;
      symbol: string;
      first_seen_at: string;
      source: string;
      confidence: number | null;
      classification: string | null;
    }>(
      `SELECT
         o.token_address, o.chain, o.name, o.symbol, o.first_seen_at, o.source,
         c.confidence, c.classification
       FROM clonet.token_observations o
       LEFT JOIN (
         SELECT token_address, chain, confidence, classification,
                ROW_NUMBER() OVER (PARTITION BY token_address, chain ORDER BY classified_at DESC) as rn
         FROM clonet.classifications
       ) c ON o.token_address = c.token_address AND o.chain = c.chain AND c.rn = 1
       WHERE 1=1 ${chainFilter}
       ORDER BY o.first_seen_at DESC
       LIMIT ${limit}`,
    );

    const now = Date.now();
    const signals = rows.map((r, i) => {
      const createdAt = r.first_seen_at ? new Date(r.first_seen_at.replace(" ", "T")).getTime() : now;
      const ageHours = Math.max(0, Math.floor((now - createdAt) / 3600000));
      // Derive score from classification confidence, or use 0 if unclassified
      const score = r.confidence != null && r.classification === "clone"
        ? Math.round(r.confidence * 100) / 100
        : r.confidence != null
          ? Math.round((1 - r.confidence) * 100) / 100
          : 0;

      return {
        id: `sig-${i}`,
        address: r.token_address,
        chain: r.chain,
        name: r.name || "Unknown",
        symbol: r.symbol || "???",
        score,
        volume24h: 0,
        marketCap: 0,
        age: `${ageHours}h`,
        detectedAt: r.first_seen_at || new Date().toISOString(),
      };
    });

    return c.json({ success: true, data: signals });
  } catch (err) {
    // ClickHouse empty or unreachable — return empty set
    return c.json({ success: true, data: [] });
  }
});

// ---------------------------------------------------------------------------
// Circuit breaker state from Redis counters
// ---------------------------------------------------------------------------
app.get("/circuit-breaker", async (c) => {
  const now = new Date();
  const hourKey = `mas:risk:hourly:${now.toISOString().slice(0, 13)}`;
  const dayKey = `mas:risk:daily:${now.toISOString().slice(0, 10)}`;
  const budgetKey = "mas:economy:llm_cost_today";

  const [hourly, daily, llmCost] = await Promise.all([
    redis.getCounter(hourKey).catch(() => 0),
    redis.getCounter(dayKey).catch(() => 0),
    redis.getCounter(budgetKey).catch(() => 0),
  ]);

  const maxPerHour = 40;
  const maxPerDay = 200;
  const budgetPerDay = 10;

  let level: "green" | "yellow" | "orange" | "red" = "green";
  if (hourly >= maxPerHour * 0.9 || daily >= maxPerDay * 0.9) level = "red";
  else if (hourly >= maxPerHour * 0.7 || daily >= maxPerDay * 0.7) level = "orange";
  else if (hourly >= maxPerHour * 0.4 || daily >= maxPerDay * 0.4) level = "yellow";

  return c.json({
    success: true,
    data: {
      level,
      clonesLastHour: hourly,
      maxPerHour,
      clonesToday: daily,
      maxPerDay,
      llmCostToday: parseFloat(String(llmCost)) || 0,
      llmBudgetPerDay: budgetPerDay,
    },
  });
});

// ---------------------------------------------------------------------------
// Classifications
// ---------------------------------------------------------------------------
app.get("/classifications", async (c) => {
  const limit = parseInt(c.req.query("limit") || "50", 10);

  try {
    const rows = await ch.query<{
      token_address: string;
      chain: string;
      classification: string;
      confidence: number;
      original_token: string | null;
      reasoning: string;
    }>(
      `SELECT token_address, chain, classification, confidence, original_token, reasoning
       FROM clonet.classifications
       ORDER BY classified_at DESC
       LIMIT ${limit}`,
    );

    const data = rows.map((r, i) => ({
      address: r.token_address,
      chain: r.chain,
      isClone: r.classification === "clone",
      confidence: r.confidence,
      originalToken: r.original_token,
      similarityScore: r.confidence,
      reasoning: r.reasoning ? r.reasoning.split(",") : [],
      strategy: "unknown",
      riskLevel: r.classification === "clone" ? "high" : r.classification === "original" ? "low" : "medium",
    }));

    return c.json({ success: true, data });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

// ---------------------------------------------------------------------------
// Deployments
// ---------------------------------------------------------------------------
app.get("/deployments", async (c) => {
  const limit = parseInt(c.req.query("limit") || "50", 10);

  try {
    const rows = await ch.query<{
      clone_address: string;
      original_address: string;
      chain: string;
      naming_strategy: string;
      deploy_method: string;
      deploy_tx: string;
      deployed_at: string;
    }>(
      `SELECT clone_address, original_address, chain, naming_strategy, deploy_method, deploy_tx, deployed_at
       FROM clonet.clone_deployments
       ORDER BY deployed_at DESC
       LIMIT ${limit}`,
    );

    const data = rows.map((r, i) => ({
      id: `dep-${i}`,
      tokenName: `Clone-${r.clone_address.slice(0, 6)}`,
      chain: r.chain,
      strategy: r.naming_strategy,
      status: "success" as const,
      deployedAt: r.deployed_at,
      txHash: r.deploy_tx,
      pnl: 0,
    }));

    return c.json({ success: true, data });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

// ---------------------------------------------------------------------------
// Modules status
// ---------------------------------------------------------------------------
app.get("/modules", async (c) => {
  const modules = [
    { id: "recon", name: "RECON", enabled: true, status: "running" },
    { id: "mint", name: "MINT", enabled: true, status: "running" },
    { id: "detect", name: "DETECT", enabled: true, status: "running" },
    { id: "risk", name: "RISK", enabled: true, status: "running" },
    { id: "oracle", name: "ORACLE", enabled: false, status: "stopped" },
    { id: "txeng", name: "TXENG", enabled: true, status: "running" },
    { id: "chain", name: "CHAIN", enabled: true, status: "running" },
    { id: "viral", name: "VIRAL", enabled: false, status: "stopped" },
    { id: "economy", name: "ECONOMY", enabled: true, status: "running" },
  ];

  // Check Redis for actual module heartbeats
  const r = redis.getRedis();
  const enriched = await Promise.all(
    modules.map(async (m) => {
      const heartbeat = await r.get(`mas:heartbeat:${m.id}`).catch(() => null);
      if (heartbeat) {
        const age = Date.now() - new Date(heartbeat).getTime();
        if (age > 60_000) return { ...m, status: "error" };
        return { ...m, status: "running" };
      }
      return m;
    }),
  );

  return c.json({ success: true, data: enriched });
});

// ---------------------------------------------------------------------------
// Classify a token (POST) — uses NVIDIA NIM models
// ---------------------------------------------------------------------------
const oracle = new OracleClassifier();

app.post("/classify", async (c) => {
  const body = await c.req.json<{ token_address: string; chain: string; name?: string; symbol?: string }>();
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

  // Build token observation from request + ClickHouse
  let observation: TokenObservation = {
    token_address: body.token_address,
    chain: body.chain as import("../shared/types").Chain,
    name: body.name || "",
    symbol: body.symbol || "",
    decimals: 9,
    created_at: new Date().toISOString(),
  };

  try {
    const rows = await ch.query<TokenObservation>(
      `SELECT * FROM clonet.token_observations WHERE token_address = '${body.token_address}' AND chain = '${body.chain}' ORDER BY first_seen_at DESC LIMIT 1`,
    );
    if (rows.length > 0) observation = { ...observation, ...rows[0] };
  } catch {
    // ClickHouse empty or unreachable
  }

  // Classify via NVIDIA NIM (Llama 4 / DeepSeek / Llama 3.3)
  const result = await oracle.classify(observation);

  // Persist to ClickHouse
  try {
    await ch.insertClassifications([{
      token_address: result.token_address,
      chain: result.chain,
      classification: result.classification,
      confidence: result.confidence,
      reasoning: result.reasoning,
      classified_at: result.classified_at,
    }]);
  } catch {
    // Insert failed, still return result
  }

  return c.json({ success: true, data: result });
});

// ---------------------------------------------------------------------------
// Analysis endpoints
// ---------------------------------------------------------------------------
app.get("/analysis/metrics", async (c) => {
  try {
    const [sigCount, depCount, classCount] = await Promise.all([
      ch.query<{ count: string }>("SELECT count() as count FROM clonet.token_observations")
        .then((r) => parseInt(r[0]?.count || "0", 10))
        .catch(() => 0),
      ch.query<{ count: string }>("SELECT count() as count FROM clonet.clone_deployments")
        .then((r) => parseInt(r[0]?.count || "0", 10))
        .catch(() => 0),
      ch.query<{ count: string }>("SELECT count() as count FROM clonet.classifications")
        .then((r) => parseInt(r[0]?.count || "0", 10))
        .catch(() => 0),
    ]);

    return c.json({
      success: true,
      data: { signals: sigCount, deployments: depCount, classifications: classCount, profitLoss: 0 },
    });
  } catch {
    return c.json({
      success: true,
      data: { signals: 0, deployments: 0, classifications: 0, profitLoss: 0 },
    });
  }
});

app.get("/analysis/performance", async (c) => {
  return c.json({
    success: true,
    data: { roi: 0, winRate: 0, avgMultiple: 0, riskScore: 0 },
  });
});

app.get("/analysis/hourly", async (c) => {
  try {
    // Get classification counts grouped by hour for last 24h
    const rows = await ch.query<{
      hour: string;
      total: string;
      clones: string;
    }>(
      `SELECT
         formatDateTime(classified_at, '%Y-%m-%d %H:00:00') as hour,
         count() as total,
         countIf(classification = 'clone') as clones
       FROM clonet.classifications
       WHERE classified_at >= now() - INTERVAL 24 HOUR
       GROUP BY hour
       ORDER BY hour ASC`,
    );

    const data = rows.map((r) => ({
      time: r.hour.slice(11, 16),
      classified: parseInt(r.total, 10),
      clones: parseInt(r.clones, 10),
    }));

    return c.json({ success: true, data });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

// ---------------------------------------------------------------------------
// Deploy endpoint
// ---------------------------------------------------------------------------
app.post("/deploy", async (c) => {
  const body = await c.req.json();
  return c.json({
    success: true,
    data: {
      id: `dep-${Date.now()}`,
      tokenName: body.name || "unknown",
      chain: body.chain || "solana",
      strategy: body.strategy || "substitution",
      status: "pending",
      deployedAt: new Date().toISOString(),
      txHash: "",
      pnl: 0,
    },
  });
});

// ---------------------------------------------------------------------------
// Dataset export
// ---------------------------------------------------------------------------
app.get("/dataset/export", async (c) => {
  const chain = c.req.query("chain") || "all";
  const isCloneParam = c.req.query("isClone");
  const limit = parseInt(c.req.query("limit") || "1000", 10);

  let chainFilter = "";
  if (chain !== "all") {
    chainFilter = `AND chain = '${chain}'`;
  }
  let cloneFilter = "";
  if (isCloneParam === "true") {
    cloneFilter = `AND classification = 'clone'`;
  } else if (isCloneParam === "false") {
    cloneFilter = `AND classification != 'clone'`;
  }

  try {
    const rows = await ch.query<{
      token_address: string;
      chain: string;
      classification: string;
      confidence: number;
      original_token: string | null;
      reasoning: string;
      classified_at: string;
    }>(
      `SELECT token_address, chain, classification, confidence, original_token, reasoning, classified_at
       FROM clonet.classifications
       WHERE 1=1 ${chainFilter} ${cloneFilter}
       ORDER BY classified_at DESC
       LIMIT ${limit}`,
    );

    // Return as DatasetRow shape
    const data = rows.map((r, i) => ({
      id: `row-${i}`,
      address: r.token_address,
      chain: r.chain,
      isClone: r.classification === "clone",
      confidence: r.confidence || 0,
      originalToken: r.original_token || "N/A",
      similarity: r.classification === "clone" ? r.confidence : 0,
      classifiedAt: r.classified_at,
    }));

    return c.json({ success: true, data });
  } catch {
    return c.json({ success: true, data: [] });
  }
});

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------
app.onError((err, c) => {
  if (err instanceof MasError) {
    return c.json({ error: { code: err.code, message: err.message, fix: err.fix } }, 500);
  }
  return c.json({ error: { code: "MAS_E9999", message: err.message } }, 500);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const port = parseInt(process.env.PORT || "8080", 10);
console.log(`MAS API starting on port ${port}`);
serve({ fetch: app.fetch, port });
