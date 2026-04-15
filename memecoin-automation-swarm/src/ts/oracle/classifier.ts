import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import type { TokenObservation, ClassificationResult, Classification } from "../shared/types";
import { getRedis, incrFloat, getCounter } from "../shared/redis";

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

export class OracleClassifier {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private dailyBudget: number;
  private modelChain: string[];

  constructor(opts?: { dailyBudget?: number; modelChain?: string[] }) {
    this.dailyBudget = opts?.dailyBudget ?? 10.0;
    this.modelChain = opts?.modelChain ?? ["gpt-4o", "claude-sonnet-4-20250514", "rule-based"];

    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI();
    }
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic();
    }
  }

  async checkBudget(): Promise<boolean> {
    const key = `mas:risk:llm_cost:${new Date().toISOString().slice(0, 10)}`;
    const spent = await getCounter(key);
    return spent < this.dailyBudget;
  }

  async classify(token: TokenObservation): Promise<ClassificationResult> {
    if (!await this.checkBudget()) {
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

    // Try GPT-4o first
    if (this.openai) {
      try {
        const result = await this.callOpenAI(tokenData);
        await incrFloat(`mas:risk:llm_cost:${new Date().toISOString().slice(0, 10)}`, 0.003);
        return {
          token_address: token.token_address,
          chain: token.chain,
          classification: result.classification,
          confidence: result.confidence,
          reasoning: result.reasoning,
          model_used: "gpt-4o",
          classified_at: new Date().toISOString(),
          cost_usd: 0.003,
        };
      } catch {
        // fall through
      }
    }

    // Try Claude
    if (this.anthropic) {
      try {
        const result = await this.callAnthropic(tokenData);
        await incrFloat(`mas:risk:llm_cost:${new Date().toISOString().slice(0, 10)}`, 0.003);
        return {
          token_address: token.token_address,
          chain: token.chain,
          classification: result.classification,
          confidence: result.confidence,
          reasoning: result.reasoning,
          model_used: "claude-sonnet",
          classified_at: new Date().toISOString(),
          cost_usd: 0.003,
        };
      } catch {
        // fall through
      }
    }

    // Fallback to rule-based
    return this.ruleBasedFallback(token);
  }

  private async callOpenAI(data: string): Promise<LLMClassification> {
    const resp = await this.openai!.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: CLASSIFICATION_PROMPT },
        { role: "user", content: `Classify this token: ${data}` },
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
    });
    return JSON.parse(resp.choices[0]?.message?.content ?? "{}") as LLMClassification;
  }

  private async callAnthropic(data: string): Promise<LLMClassification> {
    const resp = await this.anthropic!.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [
        { role: "user", content: `${CLASSIFICATION_PROMPT}\n\nClassify this token: ${data}` },
      ],
    });
    const text = resp.content[0]?.type === "text" ? resp.content[0].text : "{}";
    return JSON.parse(text) as LLMClassification;
  }

  private ruleBasedFallback(token: TokenObservation): ClassificationResult {
    return {
      token_address: token.token_address,
      chain: token.chain,
      classification: "unknown",
      confidence: 0.0,
      reasoning: "Rule-based fallback: no LLM available",
      model_used: "rule-based",
      classified_at: new Date().toISOString(),
      cost_usd: 0,
    };
  }
}
