export class BnbChainClient {
  private rpcUrl: string;

  constructor(rpcUrl?: string) {
    this.rpcUrl = rpcUrl || process.env.BNB_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545";
  }

  async deployToken(_name: string, _symbol: string): Promise<string> {
    throw new Error("BNB chain token deployment not yet implemented");
  }

  async getTransactions(_address: string): Promise<unknown[]> {
    throw new Error("BNB chain transaction query not yet implemented");
  }
}
