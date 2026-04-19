export class BaseChainClient {
  private rpcUrl: string;
  private deployerUrl?: string;

  constructor(rpcUrl?: string, deployerUrl?: string) {
    this.rpcUrl =
      rpcUrl || process.env.BASE_RPC_URL || "https://sepolia.base.org";
    this.deployerUrl = deployerUrl || process.env.BASE_DEPLOYER_URL;
  }

  async deployToken(name: string, symbol: string): Promise<string> {
    if (!this.deployerUrl) {
      throw new Error("BASE_DEPLOYER_URL is required to deploy Base tokens");
    }

    const response = await fetch(this.deployerUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chain: "base", name, symbol }),
    });
    if (!response.ok) {
      throw new Error(`Base deploy failed with status ${response.status}`);
    }

    const payload = (await response.json()) as { tokenAddress?: string };
    if (!payload.tokenAddress) {
      throw new Error("Base deployer response missing tokenAddress");
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
        `Base transaction query failed with status ${response.status}`,
      );
    }

    const payload = (await response.json()) as { result?: unknown[] };
    return payload.result ?? [];
  }
}
