import { afterEach, describe, expect, test } from "bun:test";
import { BaseChainClient } from "../chain/base";
import { BnbChainClient } from "../chain/bnb";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("BaseChainClient", () => {
  test("getTransactions returns rpc logs", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ result: [{ hash: "0xabc" }] }), {
        status: 200,
      })) as unknown as typeof fetch;

    const client = new BaseChainClient("http://base-rpc.local");
    await expect(
      client.getTransactions("0x123"),
    ).resolves.toEqual([{ hash: "0xabc" }]);
  });

  test("deployToken calls configured deployer", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ tokenAddress: "0xbase" }), {
        status: 200,
      })) as unknown as typeof fetch;

    const client = new BaseChainClient(
      undefined,
      "http://base-deployer.local",
    );
    await expect(client.deployToken("Token", "TKN")).resolves.toBe("0xbase");
  });
});

describe("BnbChainClient", () => {
  test("getTransactions returns rpc logs", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ result: [{ hash: "0xdef" }] }), {
        status: 200,
      })) as unknown as typeof fetch;

    const client = new BnbChainClient("http://bnb-rpc.local");
    await expect(
      client.getTransactions("0x456"),
    ).resolves.toEqual([{ hash: "0xdef" }]);
  });

  test("deployToken calls configured deployer", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ tokenAddress: "0xbnb" }), {
        status: 200,
      })) as unknown as typeof fetch;

    const client = new BnbChainClient(undefined, "http://bnb-deployer.local");
    await expect(client.deployToken("Token", "TKN")).resolves.toBe("0xbnb");
  });
});
