import { getRedis } from "./redis";

/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
interface NonceStoreClient {
  set(
    key: string,
    value: string,
    mode: "EX",
    ttlSeconds: number,
    nx: "NX",
  ): Promise<"OK" | null>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
}

export class NonceStore {
  constructor(
    private client: NonceStoreClient = getRedis() as NonceStoreClient,
  ) {}

  async reserveNonce(
    scope: string,
    nonce: string,
    ttlSeconds: number = 300,
  ): Promise<boolean> {
    const key = this.key(scope, nonce);
    const result = await this.client.set(key, "1", "EX", ttlSeconds, "NX");
    return result === "OK";
  }

  async hasNonce(scope: string, nonce: string): Promise<boolean> {
    const key = this.key(scope, nonce);
    const existing = await this.client.get(key);
    return existing !== null;
  }

  async clearNonce(scope: string, nonce: string): Promise<void> {
    const key = this.key(scope, nonce);
    await this.client.del(key);
  }

  generateNonce(): string {
    return crypto.randomUUID();
  }

  private key(scope: string, nonce: string): string {
    return `mas:consensus:nonce:${scope}:${nonce}`;
  }
}

export const nonceStore = new NonceStore();
