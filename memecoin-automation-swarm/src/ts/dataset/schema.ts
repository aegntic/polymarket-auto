import { z } from "zod";

export const CloneNetRecordSchema = z.object({
  token_address: z.string(),
  chain: z.enum(["solana", "base", "bnb"]),
  name: z.string(),
  symbol: z.string(),
  classification: z.enum(["clone", "original", "unknown"]),
  confidence: z.number().min(0).max(1),
  clone_strategy: z.enum(["substitution", "homophone", "suffix", "unicode", "other"]).optional(),
  original_token: z.string().optional(),
  reasoning: z.string(),
  model_used: z.string().optional(),
  created_at: z.string(),
  classified_at: z.string(),
  cost_usd: z.number(),
});

export type CloneNetRecord = z.infer<typeof CloneNetRecordSchema>;

export function validateRecord(record: unknown): CloneNetRecord {
  return CloneNetRecordSchema.parse(record);
}

export function toJSONL(records: CloneNetRecord[]): string {
  return records.map((r) => JSON.stringify(r)).join("\n");
}

export function toCSV(records: CloneNetRecord[]): string {
  if (records.length === 0) return "";
  const headers = Object.keys(records[0]).join(",");
  const rows = records.map((r) =>
    Object.values(r)
      .map((v) => (typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : String(v ?? "")))
      .join(","),
  );
  return [headers, ...rows].join("\n");
}
