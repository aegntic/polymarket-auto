export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

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

export type Chain = "solana" | "base" | "bnb";

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
  actualMultiple?: number;
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
  level: "green" | "yellow" | "orange" | "red";
  clonesLastHour: number;
  maxPerHour: number;
  clonesToday: number;
  maxPerDay: number;
  llmCostToday: number;
  llmBudgetPerDay: number;
}

export interface ModuleStatus {
  id:
    | "recon"
    | "mint"
    | "detect"
    | "risk"
    | "oracle"
    | "txeng"
    | "chain"
    | "viral"
    | "economy";
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

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${path}`;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      success: false,
      error: `HTTP ${response.status}: ${errorText}`,
    };
  }

  const data = await response.json();
  return { success: true, data };
}

export async function getHealth(): Promise<ApiResponse<SystemHealth>> {
  return apiFetch<SystemHealth>("/health");
}

export async function getClassifications(): Promise<
  ApiResponse<ClassificationResult[]>
> {
  return apiFetch<ClassificationResult[]>("/classifications");
}

export async function getSignals({
  chain,
  limit = 50,
}: { chain?: Chain; limit?: number } = {}): Promise<
  ApiResponse<TokenSignal[]>
> {
  const params: Record<string, string> = {};
  if (chain) params.chain = chain;
  params.limit = String(limit);
  const paramString = new URLSearchParams(params as any).toString();
  return apiFetch<TokenSignal[]>(
    `/signals${paramString ? "?" + paramString : ""}`,
  );
}

export async function getDeployments(): Promise<ApiResponse<Deployment[]>> {
  return apiFetch<Deployment[]>("/deployments");
}

export async function getCircuitBreaker(): Promise<
  ApiResponse<CircuitBreakerState>
> {
  return apiFetch<CircuitBreakerState>("/circuit-breaker");
}

export async function getModules(): Promise<ApiResponse<ModuleStatus[]>> {
  return apiFetch<ModuleStatus[]>("/modules");
}

export async function getDataset({
  chain,
  isClone,
  page = 0,
  pageSize = 100,
}: {
  chain?: Chain;
  isClone?: boolean;
  page?: number;
  pageSize?: number;
} = {}): Promise<ApiResponse<DatasetRow[]>> {
  const params: Record<string, string> = {};
  if (chain) params.chain = chain;
  if (isClone !== undefined) params.isClone = String(isClone);
  params.page = String(page);
  params.pageSize = String(pageSize);
  const paramString = new URLSearchParams(params as any).toString();
  return apiFetch<DatasetRow[]>(
    `/dataset/export${paramString ? "?" + paramString : ""}`,
  );
}

export async function deployToken(
  payload: any,
): Promise<ApiResponse<Deployment>> {
  return apiFetch<Deployment>("/deploy", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAnalysisMetrics(): Promise<
  ApiResponse<{
    signals: number;
    deployments: number;
    classifications: number;
    profitLoss: number;
  }>
> {
  return apiFetch<{
    signals: number;
    deployments: number;
    classifications: number;
    profitLoss: number;
  }>("/analysis/metrics");
}

export async function getPerformanceReport(): Promise<
  ApiResponse<{
    roi: number;
    winRate: number;
    avgMultiple: number;
    riskScore: number;
  }>
> {
  return apiFetch<{
    roi: number;
    winRate: number;
    avgMultiple: number;
    riskScore: number;
  }>("/analysis/performance");
}

export async function collectAllData(): Promise<{
  health: SystemHealth;
  signals: TokenSignal[];
  deployments: Deployment[];
  classifications: ClassificationResult[];
  modules: ModuleStatus[];
  dataset: DatasetRow[];
  metrics: {
    signals: number;
    deployments: number;
    classifications: number;
    profitLoss: number;
  };
  performance: {
    roi: number;
    winRate: number;
    avgMultiple: number;
    riskScore: number;
  };
}> {
  const [
    healthRes,
    signalsRes,
    deploymentsRes,
    classificationsRes,
    modulesRes,
    datasetRes,
    metricsRes,
    performanceRes,
  ] = await Promise.allSettled([
    getHealth(),
    getSignals({ limit: 50 }),
    getDeployments(),
    getClassifications(),
    getModules(),
    getDataset({ pageSize: 100 }),
    getAnalysisMetrics(),
    getPerformanceReport(),
  ]);

  return {
    health:
      healthRes.status === "fulfilled" && healthRes.value.success
        ? healthRes.value.data!
        : {
            status: "degraded",
            redis: "disconnected",
            clickhouse: "disconnected",
            timestamp: new Date().toISOString(),
          },
    signals:
      signalsRes.status === "fulfilled" && signalsRes.value.success
        ? signalsRes.value.data!
        : [],
    deployments:
      deploymentsRes.status === "fulfilled" && deploymentsRes.value.success
        ? deploymentsRes.value.data!
        : [],
    classifications:
      classificationsRes.status === "fulfilled" &&
      classificationsRes.value.success
        ? classificationsRes.value.data!
        : [],
    modules:
      modulesRes.status === "fulfilled" && modulesRes.value.success
        ? modulesRes.value.data!
        : [],
    dataset:
      datasetRes.status === "fulfilled" && datasetRes.value.success
        ? datasetRes.value.data!
        : [],
    metrics:
      metricsRes.status === "fulfilled" && metricsRes.value.success
        ? metricsRes.value.data!
        : { signals: 0, deployments: 0, classifications: 0, profitLoss: 0 },
    performance:
      performanceRes.status === "fulfilled" && performanceRes.value.success
        ? performanceRes.value.data!
        : { roi: 0, winRate: 0, avgMultiple: 0, riskScore: 0 },
  };
}
