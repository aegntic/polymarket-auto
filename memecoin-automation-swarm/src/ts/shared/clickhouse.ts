import { createClient, ClickHouseClient as ChClient } from "@clickhouse/client";

let client: ChClient | null = null;

export function getClickHouse(): ChClient {
  if (!client) {
    client = createClient({
      host: process.env.CLICKHOUSE_URL || "http://localhost:8123",
      database: "clonet",
    });
  }
  return client;
}

export async function insertObservations(
  batch: Record<string, unknown>[],
): Promise<void> {
  const ch = getClickHouse();
  await ch.insert({
    table: "token_observations",
    values: batch,
    format: "JSONEachRow",
  });
}

export async function insertClassifications(
  batch: Record<string, unknown>[],
): Promise<void> {
  const ch = getClickHouse();
  await ch.insert({
    table: "classifications",
    values: batch,
    format: "JSONEachRow",
  });
}

export async function query<T>(sql: string): Promise<T[]> {
  const ch = getClickHouse();
  const result = await ch.query({
    query: sql,
    format: "JSONEachRow",
  });
  return (await result.json()) as T[];
}

export async function ping(): Promise<boolean> {
  try {
    const ch = getClickHouse();
    await ch.ping();
    return true;
  } catch {
    return false;
  }
}
