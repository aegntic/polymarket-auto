import { describe, test, expect } from "bun:test";
import { validateRecord, toJSONL, toCSV } from "../dataset/schema";

describe("validateRecord", () => {
  test("valid record passes", () => {
    const record = {
      token_address: "abc123",
      chain: "solana",
      name: "TestToken",
      symbol: "TST",
      classification: "clone",
      confidence: 0.95,
      reasoning: "Name matches known token",
      created_at: "2026-01-01T00:00:00Z",
      classified_at: "2026-01-01T00:00:00Z",
      cost_usd: 0.003,
    };
    expect(() => validateRecord(record)).not.toThrow();
  });

  test("invalid chain fails", () => {
    const record = {
      token_address: "abc123",
      chain: "invalid_chain",
      name: "TestToken",
      symbol: "TST",
      classification: "clone",
      confidence: 0.95,
      reasoning: "test",
      created_at: "2026-01-01T00:00:00Z",
      classified_at: "2026-01-01T00:00:00Z",
      cost_usd: 0,
    };
    expect(() => validateRecord(record)).toThrow();
  });

  test("confidence > 1 fails", () => {
    const record = {
      token_address: "abc123",
      chain: "solana",
      name: "TestToken",
      symbol: "TST",
      classification: "clone",
      confidence: 1.5,
      reasoning: "test",
      created_at: "2026-01-01T00:00:00Z",
      classified_at: "2026-01-01T00:00:00Z",
      cost_usd: 0,
    };
    expect(() => validateRecord(record)).toThrow();
  });
});

describe("toJSONL", () => {
  test("serializes records to newline-delimited JSON", () => {
    const records = [
      { token_address: "a", chain: "solana" as const, name: "A", symbol: "A", classification: "clone" as const, confidence: 0.9, reasoning: "test", created_at: "2026-01-01", classified_at: "2026-01-01", cost_usd: 0 },
      { token_address: "b", chain: "solana" as const, name: "B", symbol: "B", classification: "original" as const, confidence: 0.8, reasoning: "test", created_at: "2026-01-01", classified_at: "2026-01-01", cost_usd: 0 },
    ];
    const jsonl = toJSONL(records);
    expect(jsonl).toContain("\n");
    expect(() => JSON.parse(jsonl.split("\n")[0])).not.toThrow();
  });
});

describe("toCSV", () => {
  test("serializes records to CSV", () => {
    const records = [
      { token_address: "a", chain: "solana" as const, name: "A", symbol: "A", classification: "clone" as const, confidence: 0.9, reasoning: "test", created_at: "2026-01-01", classified_at: "2026-01-01", cost_usd: 0 },
    ];
    const csv = toCSV(records);
    expect(csv.split("\n").length).toBe(2); // header + 1 row
  });
});
