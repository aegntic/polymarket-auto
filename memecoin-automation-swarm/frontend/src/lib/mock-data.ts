import { createPrng } from "./prng";

const prng = createPrng(42);

// ---------- Types ----------

export type Chain = "solana" | "base" | "bnb";
export type CircuitBreakerLevel = "green" | "yellow" | "orange" | "red";
export type ModuleId =
  | "recon"
  | "mint"
  | "detect"
  | "risk"
  | "oracle"
  | "txeng"
  | "chain"
  | "viral"
  | "economy";

export interface TokenSignal {
  id: string;
  address: string;
  name: string;
  symbol: string;
  chain: Chain;
  score: number;
  volume24h: number;
  marketCap: number;
  age: string;
  detectedAt: string;
}

export interface ClassificationResult {
  address: string;
  chain: Chain;
  isClone: boolean;
  confidence: number;
  originalToken?: string;
  similarityScore: number;
  reasoning: string[];
  strategy: string;
  riskLevel: "low" | "medium" | "high";
}

export interface Deployment {
  id: string;
  tokenName: string;
  chain: Chain;
  strategy: string;
  status: "success" | "failed" | "pending";
  deployedAt: string;
  txHash: string;
  pnl: number;
}

export interface ActivityDataPoint {
  time: string;
  classified: number;
  clones: number;
  cost: number;
}

export interface SystemHealth {
  status: "operational" | "degraded" | "down";
  redis: "connected" | "disconnected";
  clickhouse: "connected" | "disconnected";
  timestamp: string;
}

export interface CircuitBreakerState {
  level: CircuitBreakerLevel;
  clonesLastHour: number;
  maxPerHour: number;
  clonesToday: number;
  maxPerDay: number;
  llmCostToday: number;
  llmBudgetPerDay: number;
}

export interface ModuleStatus {
  id: ModuleId;
  name: string;
  enabled: boolean;
  status: "running" | "stopped" | "error";
}

export interface DatasetRow {
  id: string;
  address: string;
  chain: Chain;
  isClone: boolean;
  confidence: number;
  originalToken: string;
  similarity: number;
  classifiedAt: string;
}

// ---------- Mock Data ----------

const CHAINS: Chain[] = ["solana", "base", "bnb"];
const TOKEN_NAMES = [
  "PepeClon", "DogWifScarf", "ShibElon", "FlokiInu2", "SafeMoonV3",
  "BonkKiller", "WojToken", "MoonShot", "LamboCoin", "RocketDoge",
  "CatWifHat", "TrumpMAGA", "BidenBucks", "ElonMars", "SatoshiJunior",
  "MiladyPepe", "GigaChad", "SigmaCoin", "BasedDoge", "ChainSaw",
];
const SYMBOLS = [
  "PEPEC", "DWS", "SHE", "FKI2", "SFM3", "BNKK", "WOJ", "MSHT",
  "LMBC", "RKDG", "CWH", "TMAG", "BBUX", "EMRS", "SJR", "MLP", "GCHD",
  "SGMA", "BDOGE", "CSAW",
];
const STRATEGIES = [
  "mirror-liquidity", "front-run-sniper", "copy-honeypot",
  "meme-riding", "social-amplify", "flash-deploy",
];

function randInt(min: number, max: number) {
  return Math.floor(prng() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number) {
  return prng() * (max - min) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(prng() * arr.length)];
}

function fakeAddress(chain: Chain): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const len = chain === "solana" ? 44 : 42;
  let addr = chain === "solana" ? "" : "0x";
  for (let i = addr.length; i < len; i++) {
    addr += chars[Math.floor(prng() * chars.length)];
  }
  return addr;
}

export function generateSignals(count: number): TokenSignal[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `sig-${i + 1}`,
    address: fakeAddress(pick(CHAINS)),
    name: pick(TOKEN_NAMES),
    symbol: pick(SYMBOLS),
    chain: pick(CHAINS),
    score: Math.round(randFloat(0.3, 1) * 100) / 100,
    volume24h: Math.round(randFloat(1000, 5000000)),
    marketCap: Math.round(randFloat(10000, 50000000)),
    age: `${randInt(1, 48)}h`,
    detectedAt: new Date(Date.now() - randInt(0, 3600000)).toISOString(),
  }));
}

export function generateClassification(
  address: string,
  chain: Chain
): ClassificationResult {
  const isClone = prng() > 0.35;
  return {
    address,
    chain,
    isClone,
    confidence: Math.round(randFloat(0.55, 0.99) * 100) / 100,
    originalToken: isClone ? pick(TOKEN_NAMES) : undefined,
    similarityScore: isClone ? Math.round(randFloat(0.6, 0.98) * 100) / 100 : 0,
    reasoning: [
      isClone ? "Name similarity exceeds 85% threshold" : "No significant name similarity found",
      isClone ? "Contract bytecode pattern matches known clone factories" : "Unique contract structure detected",
      isClone ? "Deployer wallet linked to 12+ clone tokens" : "Deployer has clean history",
      isClone ? "Tokenomics mirror original with inflated supply" : "Novel token distribution model",
    ],
    strategy: isClone ? pick(STRATEGIES) : "none",
    riskLevel: isClone ? (prng() > 0.5 ? "high" : "medium") : "low",
  };
}

export function generateDeployments(count: number): Deployment[] {
  return Array.from({ length: count }, (_, i) => {
    const status = prng() > 0.15 ? (prng() > 0.2 ? "success" : "pending") : "failed";
    return {
      id: `dep-${i + 1}`,
      tokenName: pick(TOKEN_NAMES),
      chain: pick(CHAINS),
      strategy: pick(STRATEGIES),
      status: status as Deployment["status"],
      deployedAt: new Date(Date.now() - randInt(0, 604800000)).toISOString(),
      txHash: fakeAddress(pick(CHAINS)),
      pnl: status === "success" ? Math.round(randFloat(-200, 5000) * 100) / 100 : 0,
    };
  });
}

export function generateActivityData(hours: number): ActivityDataPoint[] {
  const data: ActivityDataPoint[] = [];
  const now = new Date();
  for (let i = hours; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 3600000);
    data.push({
      time: `${t.getHours().toString().padStart(2, "0")}:00`,
      classified: randInt(2, 25),
      clones: randInt(0, 8),
      cost: Math.round(randFloat(0.05, 1.2) * 100) / 100,
    });
  }
  return data;
}

export function generateCircuitBreaker(): CircuitBreakerState {
  const clonesLastHour = randInt(5, 45);
  const level: CircuitBreakerLevel =
    clonesLastHour >= 45 ? "red" :
    clonesLastHour >= 40 ? "orange" :
    clonesLastHour >= 30 ? "yellow" : "green";
  return {
    level,
    clonesLastHour,
    maxPerHour: 50,
    clonesToday: randInt(10, 55),
    maxPerDay: 50,
    llmCostToday: Math.round(randFloat(1.5, 9.8) * 100) / 100,
    llmBudgetPerDay: 10,
  };
}

export function generateModules(): ModuleStatus[] {
  const modules: Array<{ id: ModuleId; name: string }> = [
    { id: "recon", name: "RECON" },
    { id: "mint", name: "MINT" },
    { id: "detect", name: "DETECT" },
    { id: "risk", name: "RISK" },
    { id: "oracle", name: "ORACLE" },
    { id: "txeng", name: "TXENG" },
    { id: "chain", name: "CHAIN" },
    { id: "viral", name: "VIRAL" },
    { id: "economy", name: "ECONOMY" },
  ];
  return modules.map((m) => ({
    ...m,
    enabled: prng() > 0.15,
    status: prng() > 0.1 ? "running" : prng() > 0.5 ? "stopped" : "error",
  }));
}

export function generateDataset(count: number): DatasetRow[] {
  return Array.from({ length: count }, (_, i) => {
    const chain = pick(CHAINS);
    const isClone = prng() > 0.3;
    return {
      id: `row-${i + 1}`,
      address: fakeAddress(chain),
      chain,
      isClone,
      confidence: Math.round(randFloat(0.5, 0.99) * 100) / 100,
      originalToken: isClone ? pick(TOKEN_NAMES) : "N/A",
      similarity: isClone ? Math.round(randFloat(0.5, 0.99) * 100) / 100 : 0,
      classifiedAt: new Date(Date.now() - randInt(0, 604800000)).toISOString(),
    };
  });
}

export const MOCK_SYSTEM_HEALTH: SystemHealth = {
  status: "operational",
  redis: "connected",
  clickhouse: "connected",
  timestamp: new Date().toISOString(),
};

export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export function shortenAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
