export class BnbChainClient {
  private rpcUrl: string;
  private deployerUrl?: string;

  constructor(rpcUrl?: string, deployerUrl?: string) {
    this.rpcUrl =
      rpcUrl ||
      process.env.BNB_RPC_URL ||
      "https://data-seed-prebsc-1-s1.binance.org:8545";
    this.deployerUrl = deployerUrl || process.env.BNB_DEPLOYER_URL;
  }

  async deployToken(name: string, symbol: string): Promise<string> {
    if (!this.deployerUrl) {
      throw new Error("BNB_DEPLOYER_URL is required to deploy BNB tokens");
    }

    const response = await fetch(this.deployerUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chain: "bnb", name, symbol }),
    });
    if (!response.ok) {
      throw new Error(`BNB deploy failed with status ${response.status}`);
    }

    const payload = (await response.json()) as { tokenAddress?: string };
    if (!payload.tokenAddress) {
      throw new Error("BNB deployer response missing tokenAddress");
    }
    return payload.tokenAddress;
  }

  async getTransactions(address: string): Promise<unknown[]> {
    const response = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getLogs",
        params: [{ address, fromBlock: "0x0", toBlock: "latest" }],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `BNB transaction query failed with status ${response.status}`,
      );
    }

    const payload = (await response.json()) as { result?: unknown[] };
    return payload.result ?? [];
  }
}
