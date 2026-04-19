import * as ch from "../shared/clickhouse";
import { MAX_EXPORT_LIMIT } from "../shared/constants";
import { toJSONL, toCSV, type CloneNetRecord } from "./schema";

interface ExportOptions {
  format: "jsonl" | "csv";
  chain?: string;
  since?: string;
  limit?: number;
}

export function buildExportQuery(
  opts: Pick<ExportOptions, "chain" | "since" | "limit">,
): { query: string; params: Record<string, string | number> } {
  const limit =
    opts.limit && opts.limit > 0 && opts.limit <= MAX_EXPORT_LIMIT
      ? opts.limit
      : 1000;
  const filters: string[] = [];
  const params: Record<string, string | number> = { limit };

  if (opts.chain && opts.chain !== "all") {
    filters.push("AND chain = {chain:String}");
    params.chain = opts.chain;
  }
  if (opts.since) {
    filters.push("AND classified_at > {since:String}");
    params.since = opts.since;
  }

  return {
    query: `SELECT * FROM clonet.classifications WHERE 1=1 ${filters.join(" ")} ORDER BY classified_at DESC LIMIT {limit:UInt32}`,
    params,
  };
}

export async function exportDataset(opts: ExportOptions): Promise<string> {
  const { query, params } = buildExportQuery(opts);
  const records = await ch.query(query, params);

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
