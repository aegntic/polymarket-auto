import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as redis from "../shared/redis";
import * as ch from "../shared/clickhouse";
import { MasError, ERROR_CODES } from "../shared/types";
import type {
  Classification,
  ClassificationResult,
  TokenObservation,
} from "../shared/types";
import { OracleClassifier } from "../oracle/classifier";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import {
  startPipeline,
  stopPipeline,
  getPipelineStatus,
} from "../pipeline/orchestrator";
import {
  ConsensusGateway,
  type SpendProposal,
  BudgetValidator,
  SecurityValidator,
  StrategyValidator,
} from "../risk/consensus";
import { ViralSwarm } from "../viral/swarm";

const app = new Hono();

app.use("*", cors());

// Instantiate global ConsensusGateway
const gateway = new ConsensusGateway();

// Start the orchestrator pipeline
startPipeline();

// ---------------------------------------------------------------------------
// Solana wallet configuration
// ---------------------------------------------------------------------------
const HELIUS_KEY = process.env.HELIUS_API_KEY;
const rpcUrl = HELIUS_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`
  : "https://api.mainnet-beta.solana.com";
const connection = new Connection(rpcUrl, "confirmed");

let deployerKeypair: Keypair | null = null;
const WALLET_FILE = path.join(process.cwd(), ".deployer_wallet.json");

if (process.env.DEPLOYER_PRIVATE_KEY) {
  try {
    deployerKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(process.env.DEPLOYER_PRIVATE_KEY)),
    );
    console.log(
      `Deployer wallet loaded from env: ${deployerKeypair.publicKey.toString()}`,
    );
  } catch (err) {
    console.error("ERROR: Failed to parse DEPLOYER_PRIVATE_KEY from env", err);
  }
} else if (fs.existsSync(WALLET_FILE)) {
  try {
    const data = fs.readFileSync(WALLET_FILE, "utf-8");
    deployerKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(data)));
    console.log(
      `Deployer wallet loaded from file: ${deployerKeypair.publicKey.toString()}`,
    );
  } catch (err) {
    console.error(`ERROR: Failed to parse wallet file ${WALLET_FILE}`, err);
  }
}

if (!deployerKeypair) {
  console.warn("WARNING: No deployer wallet found. Creating a new one...");
  deployerKeypair = Keypair.generate();

  const secretKeyArray = Array.from(deployerKeypair.secretKey);
  try {
    fs.writeFileSync(WALLET_FILE, JSON.stringify(secretKeyArray), { mode: 0o600 });
    console.log(`\n======================================================`);
    console.log(
      `🎉 NEW WALLET CREATED: ${deployerKeypair.publicKey.toString()}`,
    );
    console.log(`💾 Saved to: ${WALLET_FILE}`);
    console.log(
      `🚨 IMPORTANT: You must fund this wallet with SOL before deploying!`,
    );
    console.log(`======================================================\n`);
  } catch (err) {
    console.error(`ERROR: Failed to write new wallet to ${WALLET_FILE}`, err);
  }
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get("/health", async (c) => {
  const [redisOk, chOk] = await Promise.all([
    redis
      .getRedis()
      .ping()
      .then(() => true)
      .catch(() => false),
    ch.ping(),
  ]);
  const status = redisOk && chOk ? "operational" : "degraded";
  return c.json({
    status,
    redis: redisOk ? "connected" : "disconnected",
    clickhouse: chOk ? "connected" : "disconnected",
    pipeline: getPipelineStatus(),
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Pipeline status endpoints
// ---------------------------------------------------------------------------
app.get("/pipeline/status", (c) => {
  return c.json({
    success: true,
    data: getPipelineStatus(),
  });
});

app.post("/pipeline/start", (c) => {
  startPipeline();
  return c.json({ success: true, data: getPipelineStatus() });
});

app.post("/pipeline/stop", (c) => {
  stopPipeline();
  return c.json({ success: true, data: getPipelineStatus() });
});

// ---------------------------------------------------------------------------
// Deploy a bait token on Solana
// ---------------------------------------------------------------------------
app.post("/deploy", async (c) => {
  const body = await c.req.json<{
    name?: string;
    symbol?: string;
    supply?: number;
    decimals?: number;
  }>();

  const name = body.name || "BaitToken";
  const symbol = body.symbol || "BAIT";
  const supply = body.supply || 1_000_000_000;
  const decimals = body.decimals || 9;

  // Return simulation if no wallet configured
  if (!deployerKeypair) {
    return c.json(
      {
        success: false,
        simulation: true,
        message:
          "No deployer wallet configured. Cannot proceed with deployment.",
      },
      400,
    );
  }

  // Consensus Check
  const proposal: SpendProposal = {
    id: `prop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    proposer: "mint-module",
    amount_sol: 0.02, // Estimate for minting/deployment
    estimated_cost_sol: 0.02,
    reason: `Vampire intercept clone of ${symbol}`,
    timestamp: Date.now(),
    nonce: Math.floor(Math.random() * 1_000_000),
  };

  const isApproved = await gateway.requestApproval(proposal);
  if (!isApproved) {
    return c.json(
      {
        error: {
          code: "MAS_E8003",
          message:
            "Consensus rejected: Authenticity gateway agents denied the spend.",
        },
      },
      403,
    );
  }

  try {
    const payer = deployerKeypair;
    const mintKeypair = Keypair.generate();

    // Create associated token account for payer
    const payerTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mintKeypair.publicKey,
      payer.publicKey,
    );

    const tx1 = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        payerTokenAccount.address,
        payer.publicKey,
        mintKeypair.publicKey,
      ),
    );

    // Fund the wallet if needed (optional - can be pre-funded)
    // const airdropSig = await connection.requestAirdrop(payer.publicKey, 0.1 * LAMPORTS_PER_SOL);
    // await connection.confirmTransaction(airdropSig);

    // Create the mint
    const createMintTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: 82, // Mint account size
        lamports: await connection.getMinimumBalanceForRentExemption(82),
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        decimals,
        payer.publicKey,
        payer.publicKey,
        TOKEN_PROGRAM_ID,
      ),
    );

    // Mint tokens to payer's associated token account
    const mintTx = new Transaction().add(
      createMintToInstruction(
        mintKeypair.publicKey,
        payerTokenAccount.address,
        payer.publicKey,
        supply * Math.pow(10, decimals),
        [],
        TOKEN_PROGRAM_ID,
      ),
    );

    // Mint tokens to payer's associated token account
    // Send transactions
    const createSig = await sendAndConfirmTransaction(
      connection,
      createMintTx,
      [payer, mintKeypair],
    );
    const mintSig = await sendAndConfirmTransaction(connection, mintTx, [
      payer,
    ]);

    return c.json({
      success: true,
      simulation: false,
      data: {
        id: `deploy-${Date.now()}`,
        tokenName: `${symbol}-${Date.now().toString(36).slice(-6)}`,
        mintAddress: mintKeypair.publicKey.toString(),
        chain: "solana",
        strategy: "substitution",
        status: "deployed",
        deployedAt: new Date().toISOString(),
        txHash: mintSig,
        pnl: 0,
        costUSD: 0.0005,
      },
    });
  } catch (err: any) {
    console.error("Deployment error:", err);
    let message = "Deployment failed";
    let fix = "Check wallet funding and RPC connectivity";

    if (err.message && err.message.includes("insufficient funds")) {
      message = `Insufficient funds in deployer wallet (${deployerKeypair?.publicKey.toString()})`;
      fix = "Please fund the deployer wallet with SOL";
    }

    return c.json(
      {
        error: {
          code: "MAS_E8002",
          message,
          fix,
        },
      },
      500,
    );
  }
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
      const createdAt = r.first_seen_at
        ? new Date(r.first_seen_at.replace(" ", "T")).getTime()
        : now;
      const ageHours = Math.max(0, Math.floor((now - createdAt) / 3600000));
      const score =
        r.confidence != null && r.classification === "clone"
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

  let level = "green";
  if (hourly >= maxPerHour * 0.9 || daily >= maxPerDay * 0.9) level = "red";
  else if (hourly >= maxPerHour * 0.7 || daily >= maxPerDay * 0.7)
    level = "orange";
  else if (hourly >= maxPerHour * 0.4 || daily >= maxPerDay * 0.4)
    level = "yellow";

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
      riskLevel:
        r.classification === "clone"
          ? "high"
          : r.classification === "original"
            ? "low"
            : "medium",
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
    { id: "oracle", name: "ORACLE", enabled: true, status: "running" },
    { id: "txeng", name: "TXENG", enabled: true, status: "running" },
    { id: "chain", name: "CHAIN", enabled: true, status: "running" },
    { id: "viral", name: "VIRAL", enabled: false, status: "stopped" },
    { id: "economy", name: "ECONOMY", enabled: true, status: "running" },
  ];

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
  const body = await c.req.json<{
    token_address: string;
    chain: string;
    name?: string;
    symbol?: string;
  }>();
  if (!body.token_address || !body.chain) {
    return c.json(
      {
        error: {
          code: "MAS_E8001",
          message: "Missing required fields: token_address, chain",
        },
      },
      400,
    );
  }

  const hourlyKey = `mas:risk:hourly:${new Date().toISOString().slice(0, 13)}`;
  const hourlyCount = await redis.getCounter(hourlyKey);
  if (hourlyCount >= 40) {
    return c.json(
      {
        error: {
          code: ERROR_CODES.CB_ORANGE,
          message: "Circuit breaker: rate limit exceeded",
        },
      },
      429,
    );
  }

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

  const result = await oracle.classify(observation);

  try {
    await ch.insertClassifications([
      {
        token_address: result.token_address,
        chain: result.chain,
        classification: result.classification,
        confidence: result.confidence,
        reasoning: result.reasoning,
        classified_at: result.classified_at,
      },
    ]);
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
      ch
        .query<{ count: string }>(
          "SELECT count() as count FROM clonet.token_observations",
        )
        .then((r) => parseInt(r[0]?.count || "0", 10))
        .catch(() => 0),
      ch
        .query<{ count: string }>(
          "SELECT count() as count FROM clonet.clone_deployments",
        )
        .then((r) => parseInt(r[0]?.count || "0", 10))
        .catch(() => 0),
      ch
        .query<{ count: string }>(
          "SELECT count() as count FROM clonet.classifications",
        )
        .then((r) => parseInt(r[0]?.count || "0", 10))
        .catch(() => 0),
    ]);

    return c.json({
      success: true,
      data: {
        signals: sigCount,
        deployments: depCount,
        classifications: classCount,
        profitLoss: 0,
      },
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
// Error handler
// ---------------------------------------------------------------------------
app.onError((err, c) => {
  if (err instanceof MasError) {
    return c.json(
      { error: { code: err.code, message: err.message, fix: err.fix } },
      500,
    );
  }
  return c.json({ error: { code: "MAS_E9999", message: err.message } }, 500);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const port = parseInt(process.env.PORT || "8080", 10);
console.log(`MAS API starting on port ${port}`);
serve({ fetch: app.fetch, port });
