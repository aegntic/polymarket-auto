const fs = require('fs');

let shared = fs.readFileSync('src/ts/recon/shared.ts', 'utf8');

// Replace pairToObservation signature to be async
shared = shared.replace(
  "export function pairToObservation(pair: DexPair): TokenObservation | null {",
  "export async function pairToObservation(pair: DexPair): Promise<TokenObservation | null> {"
);

// Add RPC imports
const rpcImports = `
import { fetchSolanaTokenInfo, fetchEvmTokenInfo } from "./rpc";
`;
shared = rpcImports + shared;

// Update the body of pairToObservation
const bodyReplacement = `
  let decimals = chain === "solana" ? 9 : 18;
  let creator_address = "";
  let supply = "";

  if (chain === "solana") {
     const info = await fetchSolanaTokenInfo(pair.baseToken.address, process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com");
     decimals = info.decimals;
     creator_address = info.creator_address;
     supply = info.supply;
  } else if (chain === "base") {
     const info = await fetchEvmTokenInfo(pair.baseToken.address, process.env.BASE_RPC_URL || "https://mainnet.base.org");
     decimals = info.decimals;
     creator_address = info.creator_address;
     supply = info.supply;
  }

  return {
    token_address: pair.baseToken.address,
    chain,
    name: pair.baseToken.name,
    symbol: pair.baseToken.symbol,
    decimals,
    supply,
    creator_address,
`;

shared = shared.replace(
  `  return {
    token_address: pair.baseToken.address,
    chain,
    name: pair.baseToken.name,
    symbol: pair.baseToken.symbol,
    decimals: chain === "solana" ? 9 : 18,
    creator_address: "",`,
  bodyReplacement
);

fs.writeFileSync('src/ts/recon/shared.ts', shared);
console.log("Updated shared.ts");
