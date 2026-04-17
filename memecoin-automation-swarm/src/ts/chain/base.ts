export class BaseChainClient {
  private rpcUrl: string;

  constructor(rpcUrl?: string) {
    this.rpcUrl =
      rpcUrl || process.env.BASE_RPC_URL || "https://sepolia.base.org";
  }

  async deployToken(_name: string, _symbol: string): Promise<string> {
    throw new Error("Base chain token deployment not yet implemented");
  }

  async getTransactions(_address: string): Promise<unknown[]> {
    throw new Error("Base chain transaction query not yet implemented");
  }
}
