// Shared interfaces for type safety across the memecoin automation system

export type Chain = "solana" | "base" | "bnb";
export type Network = "devnet" | "testnet" | "mainnet";
export type Classification = "clone" | "original" | "unknown";
export type CloneStrategy =
  | "substitution"
  | "homophone"
  | "suffix"
  | "unicode"
  | "other";
export type CircuitBreakerLevel = "green" | "yellow" | "orange" | "red";

export interface TokenObservation {
  token_address: string;
  chain: Chain;
  name: string;
  symbol: string;
  decimals: number;
  supply?: string;
  creator_address?: string;
  creation_tx?: string;
  created_at: string;
  metadata_uri?: string;
  logo_uri?: string;
  initial_liquidity_sol?: number;
  initial_market_cap_usd?: number;
  holder_count_1h?: number;
  volume_1h?: number;
  signal_score?: number;
}

export interface ClassificationResult {
  token_address: string;
  chain: Chain;
  classification: Classification;
  confidence: number;
  clone_strategy?: CloneStrategy;
  original_token?: string;
  reasoning: string;
  model_used?: string;
  classified_at: string;
  cost_usd: number;
}

export interface EventEnvelope {
  timestamp: string;
  module: string;
  event_type: string;
  payload: unknown;
}

export interface RiskStatus {
  circuit_breaker: CircuitBreakerLevel;
  clones_today: number;
  llm_spent_today: number;
  hourly_rate: number;
}

export interface AgentStatus {
  id: string;
  name: string;
  status: "active" | "idle" | "busy" | "error";
  last_heartbeat: string;
  tasks_completed: number;
  error_count: number;
}

export interface MonitoringMetrics {
  profitability_score: number;
  roi_3x_progress: number;
  active_agents: number;
  total_deployments: number;
  success_rate: number;
  average_profit_per_deployment: number;
}

export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
}

export interface EnvConfig {
  apiBaseUrl: string;
  redisUrl: string;
  clickhouseUrl: string;
  apiKey: string;
  maxDailyDeployments: number;
  llmBudgetPerDay: number;
}

export function createEnvelope(
  module: string,
  eventType: string,
  payload: unknown,
): EventEnvelope {
  return {
    timestamp: new Date().toISOString(),
    module,
    event_type: eventType,
    payload,
  };
}

// Redis channel constants
export const CHANNELS = {
  RECON_SIGNALS: "mas:recon:signals",
  MINT_DEPLOYED: "mas:mint:deployed",
  DETECT_RESULTS: "mas:detect:results",
  RISK_ALERTS: "mas:risk:alerts",
  ORACLE_RESULTS: "mas:oracle:results",
  TXENG_STATUS: "mas:txeng:status",
  ECONOMY_SETTLED: "mas:economy:settled",
} as const;

// Error codes
export const ERROR_CODES = {
  REDIS_CONN: "MAS_E1001",
  REDIS_TIMEOUT: "MAS_E1002",
  CLICKHOUSE_CONN: "MAS_E2001",
  CLICKHOUSE_INSERT: "MAS_E2002",
  CLICKHOUSE_QUERY: "MAS_E2003",
  RPC_TIMEOUT: "MAS_E3001",
  RPC_RATE_LIMIT: "MAS_E3002",
  TX_BUILD: "MAS_E4001",
  TX_SUBMIT: "MAS_E4003",
  LLM_TIMEOUT: "MAS_E5001",
  LLM_RATE: "MAS_E5002",
  LLM_PARSE: "MAS_E5003",
  LLM_BUDGET: "MAS_E5004",
  CB_YELLOW: "MAS_E6001",
  CB_ORANGE: "MAS_E6002",
  CB_RED: "MAS_E6003",
  CLONE_LIMIT: "MAS_E7001",
  BUDGET_EXCEEDED: "MAS_E7002",
} as const;

export interface AppError {
  code: string;
  message: string;
  cause?: string;
  fix?: string;
  docsUrl?: string;
}

export class MasError extends Error {
  code: string;
  cause?: string;
  fix?: string;
  docsUrl?: string;

  constructor(opts: {
    code: string;
    message: string;
    cause?: string;
    fix?: string;
    docsUrl?: string;
  }) {
    super(opts.message);
    this.name = "MasError";
    this.code = opts.code;
    this.cause = opts.cause;
    this.fix = opts.fix;
    this.docsUrl = opts.docsUrl;
  }
}
