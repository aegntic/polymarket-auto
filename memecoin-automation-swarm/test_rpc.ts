import { fetchSolanaTokenInfo, fetchEvmTokenInfo } from "./src/ts/recon/rpc";

async function main() {
  console.log("Fetching Solana Token (PEPE)...");
  const sol = await fetchSolanaTokenInfo("F9CpWoyeBJfoRB8f2pBe2ZNPbPsEE76mWZWme3StsvHK");
  console.log("Solana result:", sol);

  console.log("Fetching Base Token (PEPE)...");
  const base = await fetchEvmTokenInfo("0x698DC45e4F10966f6D1D98e3bFd7071d8144C233", "https://mainnet.base.org");
  console.log("Base result:", base);
}

main();
