import { describe, test, expect } from "bun:test";

import { buildExportQuery } from "../dataset/export";

describe("buildExportQuery", () => {
  test("uses placeholders and params for chain/since/limit", () => {
    const result = buildExportQuery({
      chain: "solana",
      since: "2026-01-01T00:00:00Z",
      limit: 50,
    });

    expect(result.query).toContain("chain = {chain:String}");
    expect(result.query).toContain("classified_at > {since:String}");
    expect(result.query).toContain("LIMIT {limit:UInt32}");
    expect(result.params).toEqual({
      chain: "solana",
      since: "2026-01-01T00:00:00Z",
      limit: 50,
    });
  });

  test("omits optional filters while keeping parameterized limit", () => {
    const result = buildExportQuery({ chain: "all", limit: 1000 });
    expect(result.query).not.toContain("chain = ");
    expect(result.query).not.toContain("classified_at > ");
    expect(result.query).toContain("LIMIT {limit:UInt32}");
    expect(result.params).toEqual({ limit: 1000 });
  });

  test("clamps invalid/oversized limits to safe default", () => {
    const result = buildExportQuery({ limit: 500000 });
    expect(result.params).toEqual({ limit: 1000 });
  });
});
