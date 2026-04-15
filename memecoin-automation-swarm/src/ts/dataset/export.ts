import * as ch from "../shared/clickhouse";
import { toJSONL, toCSV, type CloneNetRecord } from "./schema";

interface ExportOptions {
  format: "jsonl" | "csv";
  chain?: string;
  since?: string;
  limit?: number;
}

export async function exportDataset(opts: ExportOptions): Promise<string> {
  const limit = opts.limit ?? 1000;
  let chainFilter = "";
  if (opts.chain && opts.chain !== "all") {
    chainFilter = `AND chain = '${opts.chain}'`;
  }
  let timeFilter = "";
  if (opts.since) {
    timeFilter = `AND classified_at > '${opts.since}'`;
  }

  const records = await ch.query(
    `SELECT * FROM clonet.classifications WHERE 1=1 ${chainFilter} ${timeFilter} ORDER BY classified_at DESC LIMIT ${limit}`,
  );

  const typed = records as CloneNetRecord[];

  if (opts.format === "csv") {
    return toCSV(typed);
  }
  return toJSONL(typed);
}

// CLI entry point
if (typeof Bun !== "undefined" && process.argv[1]?.endsWith("export.ts")) {
  const args = process.argv.slice(2);
  const formatIdx = args.indexOf("--format");
  const chainIdx = args.indexOf("--chain");
  const format = formatIdx >= 0 ? args[formatIdx + 1] : "jsonl";
  const chain = chainIdx >= 0 ? args[chainIdx + 1] : "all";

  exportDataset({ format: format as "jsonl" | "csv", chain })
    .then((data) => console.log(data))
    .catch((err) => {
      console.error("Export failed:", err);
      process.exit(1);
    });
}
