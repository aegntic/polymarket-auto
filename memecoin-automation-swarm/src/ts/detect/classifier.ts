import type { TokenObservation, Classification, ClassificationResult } from "../shared/types";

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m][n];
}

export function nameSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshtein(a.toLowerCase(), b.toLowerCase());
  return 1.0 - dist / maxLen;
}

export function extractFeatures(token: TokenObservation): number[] {
  return [
    token.holder_count_1h ? Math.min(token.holder_count_1h / 100, 1) : 0,
    token.initial_liquidity_sol ? Math.min(token.initial_liquidity_sol / 100, 1) : 0,
    token.volume_1h ? Math.min(token.volume_1h / 10000, 1) : 0,
    token.initial_market_cap_usd ? Math.min(token.initial_market_cap_usd / 100000, 1) : 0,
  ];
}

export interface RuleScore {
  classification: Classification;
  confidence: number;
  reasoning: string;
}

export function ruleBasedClassify(
  token: TokenObservation,
  knownTokens: string[],
): RuleScore {
  let maxSimilarity = 0;
  let bestMatch = "";
  for (const known of knownTokens) {
    const sim = nameSimilarity(token.name, known);
    if (sim > maxSimilarity) {
      maxSimilarity = sim;
      bestMatch = known;
    }
  }

  if (maxSimilarity > 0.85) {
    return {
      classification: "clone",
      confidence: maxSimilarity,
      reasoning: `Name "${token.name}" is highly similar to known token "${bestMatch}" (sim=${maxSimilarity.toFixed(3)})`,
    };
  }

  if (maxSimilarity > 0.6) {
    return {
      classification: "clone",
      confidence: maxSimilarity * 0.7,
      reasoning: `Name "${token.name}" resembles "${bestMatch}" (sim=${maxSimilarity.toFixed(3)}), needs LLM verification`,
    };
  }

  return {
    classification: "original",
    confidence: 1.0 - maxSimilarity,
    reasoning: `No close matches found (max_sim=${maxSimilarity.toFixed(3)})`,
  };
}

export interface EnsembleInput {
  rule_score: number;
  ml_score: number;
  oracle_score: number;
}

export function ensembleClassify(input: EnsembleInput): { classification: Classification; confidence: number } {
  const RULE_WEIGHT = 0.3;
  const ML_WEIGHT = 0.4;
  const ORACLE_WEIGHT = 0.3;

  const combined = input.rule_score * RULE_WEIGHT
    + input.ml_score * ML_WEIGHT
    + input.oracle_score * ORACLE_WEIGHT;

  if (combined > 0.7) {
    return { classification: "clone", confidence: combined };
  } else if (combined > 0.4) {
    return { classification: "unknown", confidence: combined };
  }
  return { classification: "original", confidence: 1.0 - combined };
}
