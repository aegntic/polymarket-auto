import { createClient, ClickHouseClient as ChClient } from "@clickhouse/client";
import { MasError, ERROR_CODES } from "./types";

let client: ChClient | null = null;

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

function wrapChError(operation: string, err: unknown): MasError {
  if (err instanceof MasError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new MasError({
    code: operation.includes("insert")
      ? ERROR_CODES.CLICKHOUSE_INSERT
      : ERROR_CODES.CLICKHOUSE_QUERY,
    message: `ClickHouse ${operation} failed: ${message}`,
    cause: message,
    fix: "Check ClickHouse connectivity and table schemas",
  });
}

function isTransientError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    // Retry on network/timeout/connection errors, not on syntax/schema errors
    return (
      msg.includes("econnrefused") ||
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("socket hang up") ||
      msg.includes("network") ||
      msg.includes("timeout") ||
      msg.includes("fetch failed")
    );
  }
  return true; // Retry unknown errors conservatively
}

async function withRetry<T>(fn: () => Promise<T>, operation: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const transient = isTransientError(err);
      if (!transient || attempt >= MAX_RETRIES - 1) {
        break;
      }
      const delay = RETRY_BASE_MS * Math.pow(2, attempt);
      console.warn(
        `[ClickHouse] ${operation} failed (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delay}ms:`,
        err instanceof Error ? err.message : err,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw wrapChError(operation, lastError);
}

export function getClickHouse(): ChClient {
  if (!client) {
    client = createClient({
      host: process.env.CLICKHOUSE_URL || "http://localhost:8123",
      database: "clonet",
      request_timeout: 10_000,
    });
  }
  return client;
}

export async function insertObservations(
  batch: Record<string, unknown>[],
): Promise<void> {
  if (batch.length === 0) return;
  await withRetry(async () => {
    const ch = getClickHouse();
    await ch.insert({
      table: "token_observations",
      values: batch,
      format: "JSONEachRow",
    });
  }, "insert_observations");
}

export async function insertClassifications(
  batch: Record<string, unknown>[],
): Promise<void> {
  if (batch.length === 0) return;
  await withRetry(async () => {
    const ch = getClickHouse();
    await ch.insert({
      table: "classifications",
      values: batch,
      format: "JSONEachRow",
    });
  }, "insert_classifications");
}

export async function query<T>(
  sql: string,
  params?: Record<string, unknown>,
): Promise<T[]> {
  return withRetry(async () => {
    const ch = getClickHouse();
    const result = await ch.query({
      query: sql,
      format: "JSONEachRow",
      query_params: params,
    });
    return (await result.json()) as T[];
  }, "query");
}

export async function ping(): Promise<boolean> {
  try {
    const ch = getClickHouse();
    await ch.ping();
    return true;
  } catch (err) {
    console.debug("[ClickHouse] ping failed:", err instanceof Error ? err.message : err);
    return false;
  }
}
