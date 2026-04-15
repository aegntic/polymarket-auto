import { describe, test, expect } from "bun:test";
import { levenshtein, nameSimilarity, ruleBasedClassify, ensembleClassify } from "../detect/classifier";
import type { TokenObservation } from "../shared/types";

describe("levenshtein", () => {
  test("identical strings have distance 0", () => {
    expect(levenshtein("doge", "doge")).toBe(0);
  });

  test("single substitution", () => {
    expect(levenshtein("doge", "dogi")).toBe(1);
  });

  test("complete mismatch", () => {
    expect(levenshtein("abc", "xyz")).toBe(3);
  });

  test("empty strings", () => {
    expect(levenshtein("", "")).toBe(0);
    expect(levenshtein("a", "")).toBe(1);
  });
});

describe("nameSimilarity", () => {
  test("identical names = 1.0", () => {
    expect(nameSimilarity("dogecoin", "dogecoin")).toBe(1.0);
  });

  test("similar names have high score", () => {
    const sim = nameSimilarity("dogecoin", "dogec0in");
    expect(sim).toBeGreaterThan(0.8);
  });

  test("different names have low score", () => {
    const sim = nameSimilarity("bitcoin", "ethereum");
    expect(sim).toBeLessThan(0.5);
  });
});

describe("ruleBasedClassify", () => {
  const baseToken: TokenObservation = {
    token_address: "addr123",
    chain: "solana",
    name: "TestToken",
    symbol: "TST",
    decimals: 9,
    created_at: new Date().toISOString(),
  };

  test("classifies clone when name matches known token", () => {
    const result = ruleBasedClassify(
      { ...baseToken, name: "dogecoin" },
      ["dogecoin"],
    );
    expect(result.classification).toBe("clone");
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  test("classifies original when no match", () => {
    const result = ruleBasedClassify(
      { ...baseToken, name: "xyzunique123" },
      ["dogecoin", "shiba"],
    );
    expect(result.classification).toBe("original");
  });
});

describe("ensembleClassify", () => {
  test("high scores = clone", () => {
    const result = ensembleClassify({
      rule_score: 0.9,
      ml_score: 0.85,
      oracle_score: 0.88,
    });
    expect(result.classification).toBe("clone");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  test("low scores = original", () => {
    const result = ensembleClassify({
      rule_score: 0.1,
      ml_score: 0.15,
      oracle_score: 0.1,
    });
    expect(result.classification).toBe("original");
  });

  test("medium scores = unknown", () => {
    const result = ensembleClassify({
      rule_score: 0.5,
      ml_score: 0.5,
      oracle_score: 0.5,
    });
    expect(result.classification).toBe("unknown");
  });
});
