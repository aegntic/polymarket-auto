// Fast decision engine optimized for 3x multiple targets
// No complex dependencies - works with raw token data

export interface TokenData {
  volume24h: number;
  age: string;
  socialMentions: number;
  priceChange24h: number;
  price?: number;
}

export interface InvestmentAnalysis {
  shouldDeploy: boolean;
  chain: string;
  investment: number;
  expectedMultiple: number;
}

export interface CapitalMetrics {
  totalDeployed: number;
  successfulDeployments: number;
  averageMultiple: number;
}

export interface RiskMetrics {
  totalDeployments: number;
  successful: number;
  complianceRate: number;
}

export function evaluateQuickDecision(token: TokenData): InvestmentAnalysis {
  // Fast rule-based scoring (optimized for speed)
  const score =
    (token.volume24h > 10000 ? 0.3 : 0) +
    (parseInt(token.age) < 24 ? 0.2 : 0) +
    (token.socialMentions > 100 ? 0.3 : 0) +
    (token.priceChange24h > 0.1 ? 0.2 : 0);

  // Chain selection based on score and efficiency
  const chain = score > 0.6 ? "solana" : score > 0.4 ? "base" : "bnb";

  // Investment based on chain efficiency and token price
  const investment = calculateInvestment(chain, token.price || 0);

  // Expected multiple with buffer for 3x target
  const expectedMultiple = calculateExpectedMultiple(chain, score);

  return {
    shouldDeploy: score > 0.55,
    chain,
    investment,
    expectedMultiple,
  };
}

function calculateInvestment(chain: string, price: number): number {
  const maxInvestments = { solana: 30, base: 25, bnb: 20 };
  const maxInvestment =
    maxInvestments[chain as keyof typeof maxInvestments] || 20;
  return Math.min(maxInvestment, price > 0 ? price * 1.5 : maxInvestment);
}

function calculateExpectedMultiple(chain: string, score: number): number {
  const baseMultiple = { solana: 3.5, base: 3.2, bnb: 3.0 };
  const chainMultiple = baseMultiple[chain as keyof typeof baseMultiple] || 3.0;
  // Add score bonus to reach 3x target faster
  return chainMultiple + (score - 0.5) * 2;
}

export function trackCapitalEfficiency(deployments: any[]): CapitalMetrics {
  const totalDeployed = deployments.length;
  const successful = deployments.filter(
    (d: any) => d.status === "success",
  ).length;

  // Calculate average multiple from successful deployments
  const successfulDeployments = deployments.filter(
    (d: any) => d.status === "success",
  );
  const avgMultiple = successfulDeployments.length
    ? successfulDeployments.reduce(
        (s: number, d: any) =>
          s + (d.actualMultiple || d.expectedMultiple || 3),
        0,
      ) / successfulDeployments.length
    : 0;

  return {
    totalDeployed,
    successfulDeployments: successful,
    averageMultiple: avgMultiple,
  };
}

export function checkRiskGuardrails(deployment: any): boolean {
  return deployment.lossPercent < 0.15 && deployment.recoveryRatio > 0.25;
}

export function fastScreen(token: TokenData): boolean {
  return (
    token.volume24h > 5000 &&
    parseInt(token.age) < 48 &&
    token.priceChange24h > -0.1 &&
    token.socialMentions > 50
  );
}

export function checkBalanceProtection(
  walletBalance: number,
  deploymentCost: number,
): boolean {
  return walletBalance >= deploymentCost * 1.5;
}

export function checkCompliance(deployments: any[]): RiskMetrics {
  const total = deployments.length;
  const successful = deployments.filter(
    (d: any) => d.status === "success",
  ).length;
  return {
    totalDeployments: total,
    successful,
    complianceRate: total ? successful / total : 1,
  };
}

// Utility: Calculate required multiple to reach 3x target
export function calculateRequiredMultiple(
  initialCapital: number,
  deploymentCost: number,
  currentCapital: number,
): number {
  const totalInvestment = initialCapital + deploymentCost;
  return (totalInvestment * 3) / currentCapital;
}

// Utility: Estimate profit from multiple
export function estimateProfit(investment: number, multiple: number): number {
  return investment * multiple - investment;
}

// Utility: Check if deployment meets 3x target
export function meetsTargetMultiple(
  actualMultiple: number,
  targetMultiple: number = 3,
): boolean {
  return actualMultiple >= targetMultiple;
}
