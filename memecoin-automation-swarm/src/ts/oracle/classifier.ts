import OpenAI from "openai";
import type {
  TokenObservation,
  ClassificationResult,
  Classification,
} from "../shared/types";
import { incrFloat, getCounter } from "../shared/redis";

const NIM_BASE_URL = "https://integrate.api.nvidia.com/v1";

const CLASSIFICATION_PROMPT = `You are a memecoin clone detection classifier. Given token data, classify it as:
- "clone": if the token appears to be copying/impersonating another known token
- "original": if the token appears to be a legitimate new token
- "unknown": if there is insufficient information

Respond in JSON: { "classification": "clone"|"original"|"unknown", "confidence": 0.0-1.0, "reasoning": "..." }`;

interface LLMClassification {
  classification: Classification;
  confidence: number;
  reasoning: string;
}

// Model chain — primary, fallback, rule-based
const MODEL_CHAIN = [
  "meta/llama-4-maverick-17b-128e-instruct",
  "deepseek-ai/deepseek-v3.2",
  "meta/llama-3.3-70b-instruct",
] as const;

export class OracleClassifier {
  private client: OpenAI;
  private dailyBudget: number;
  private modelChain: string[];

  constructor(opts?: { dailyBudget?: number; modelChain?: string[] }) {
    this.dailyBudget = opts?.dailyBudget ?? 10.0;
    this.modelChain = opts?.modelChain ?? [...MODEL_CHAIN];

    this.client = new OpenAI({
      baseURL: NIM_BASE_URL,
      apiKey: process.env.NVIDIA_API_KEY || "nvapi-no-key",
    });
  }

  async checkBudget(): Promise<boolean> {
    const key = `mas:risk:llm_cost:${new Date().toISOString().slice(0, 10)}`;
    const spent = await getCounter(key);
    return spent < this.dailyBudget;
  }

  async classify(token: TokenObservation): Promise<ClassificationResult> {
    if (!process.env.NVIDIA_API_KEY) {
      return this.ruleBasedFallback(token);
    }

    if (!(await this.checkBudget())) {
      return this.ruleBasedFallback(token);
    }

    const tokenData = JSON.stringify({
      name: token.name,
      symbol: token.symbol,
      chain: token.chain,
      creator: token.creator_address,
      liquidity: token.initial_liquidity_sol,
      holders: token.holder_count_1h,
    });

    // Try each model in the chain
    for (const model of this.modelChain) {
      try {
        const result = await this.callNIM(model, tokenData);
        // NVIDIA free tier — cost is $0, but track for budget awareness
        await incrFloat(
          `mas:risk:llm_cost:${new Date().toISOString().slice(0, 10)}`,
          0.0001, // negligible cost, tracks usage volume
        );
        return {
          token_address: token.token_address,
          chain: token.chain,
          classification: result.classification,
          confidence: result.confidence,
          reasoning: result.reasoning,
          model_used: model,
          classified_at: new Date().toISOString(),
          cost_usd: 0,
        };
      } catch (err) {
        // Model unavailable, try next in chain
        console.warn(
          `[Oracle] Model '${model}' failed, trying next in chain:`,
          err instanceof Error ? err.message : err,
        );
        continue;
      }
    }

    return this.ruleBasedFallback(token);
  }

  private async callNIM(
    model: string,
    data: string,
  ): Promise<LLMClassification> {
    const resp = await this.client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: CLASSIFICATION_PROMPT },
        { role: "user", content: `Classify this token: ${data}` },
      ],
      max_tokens: 200,
      temperature: 0.1,
    });

    const content = resp.choices[0]?.message?.content ?? "{}";

    // Try direct JSON parse
    try {
      return JSON.parse(content) as LLMClassification;
    } catch {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as LLMClassification;
      }
      throw new Error(
        `Failed to parse LLM response from model: ${content.slice(0, 200)}`,
      );
    }
  }

  private ruleBasedFallback(token: TokenObservation): ClassificationResult {
    return {
      token_address: token.token_address,
      chain: token.chain,
      classification: "unknown",
      confidence: 0.0,
      reasoning: "Rule-based fallback: no NVIDIA API key configured",
      model_used: "rule-based",
      classified_at: new Date().toISOString(),
      cost_usd: 0,
    };
  }
}
