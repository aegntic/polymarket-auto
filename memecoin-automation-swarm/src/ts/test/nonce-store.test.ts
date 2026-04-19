import { describe, test, expect } from "bun:test";
import { NonceStore } from "../shared/nonce-store";

class MockNonceClient {
  private data = new Map<string, string>();
  private expiresAt = new Map<string, number>();
  private nowMs = Date.now();

  async set(
    key: string,
    value: string,
    _mode: "EX",
    _ttlSeconds: number,
    nx: "NX",
  ): Promise<"OK" | null> {
    this.purgeExpired();
    if (nx === "NX" && this.data.has(key)) {
      return null;
    }
    this.data.set(key, value);
    this.expiresAt.set(key, this.nowMs + _ttlSeconds * 1000);
    return "OK";
  }

  async get(key: string): Promise<string | null> {
    this.purgeExpired();
    return this.data.get(key) ?? null;
  }

  async del(key: string): Promise<number> {
    const existed = this.data.delete(key);
    this.expiresAt.delete(key);
    return existed ? 1 : 0;
  }

  advanceTime(seconds: number): void {
    this.nowMs += seconds * 1000;
  }

  private purgeExpired(): void {
    for (const [key, expireAt] of this.expiresAt.entries()) {
      if (expireAt <= this.nowMs) {
        this.expiresAt.delete(key);
        this.data.delete(key);
      }
    }
  }
}

describe("NonceStore", () => {
  test("rejects replayed nonce in same scope", async () => {
    const store = new NonceStore(new MockNonceClient());
    const first = await store.reserveNonce("consensus", "nonce-1");
    const second = await store.reserveNonce("consensus", "nonce-1");
    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  test("allows same nonce in different scopes", async () => {
    const store = new NonceStore(new MockNonceClient());
    const first = await store.reserveNonce("consensus-a", "nonce-1");
    const second = await store.reserveNonce("consensus-b", "nonce-1");
    expect(first).toBe(true);
    expect(second).toBe(true);
  });

  test("allows nonce reuse after ttl expires", async () => {
    const client = new MockNonceClient();
    const store = new NonceStore(client);
    const first = await store.reserveNonce("consensus", "nonce-expire", 1);
    client.advanceTime(2);
    const second = await store.reserveNonce("consensus", "nonce-expire", 1);
    expect(first).toBe(true);
    expect(second).toBe(true);
  });

  test("generateNonce produces unique values", () => {
    const store = new NonceStore(new MockNonceClient());
    const n1 = store.generateNonce();
    const n2 = store.generateNonce();
    expect(n1).not.toBe(n2);
    expect(n1.length).toBeGreaterThan(0);
    expect(n2.length).toBeGreaterThan(0);
  });
});
