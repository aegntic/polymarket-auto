const fs = require('fs');
let code = fs.readFileSync('src/ts/recon/shared.ts', 'utf8');

// Fix the import at the top
if (!code.includes('import { fetchSolanaTokenInfo, fetchEvmTokenInfo }')) {
  code = `import { fetchSolanaTokenInfo, fetchEvmTokenInfo } from "./rpc";\n` + code;
}

// Ensure pairToObservation signature is async
code = code.replace(
  /export function pairToObservation\(pair: DexPair\): TokenObservation \| null \{/g,
  'export async function pairToObservation(pair: DexPair): Promise<TokenObservation | null> {'
);

// Replace the return block to use the fetched data
code = code.replace(
  /return \{\n\s+token_address: pair.baseToken.address,\n\s+chain,\n\s+name: pair.baseToken.name,\n\s+symbol: pair.baseToken.symbol,\n\s+decimals: chain === "solana" \? 9 : 18,\n\s+creator_address: "",/g,
  `
  let decimals = chain === "solana" ? 9 : 18;
  let creator_address = "";
  let supply = "";

  // Make RPC calls
  if (chain === "solana") {
     const info = await fetchSolanaTokenInfo(pair.baseToken.address, process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com");
     decimals = info.decimals || decimals;
     creator_address = info.creator_address || "";
     supply = info.supply || "";
  } else if (chain === "base") {
     const info = await fetchEvmTokenInfo(pair.baseToken.address, process.env.BASE_RPC_URL || "https://mainnet.base.org");
     decimals = info.decimals || decimals;
     creator_address = info.creator_address || "";
     supply = info.supply || "";
  }

  return {
    token_address: pair.baseToken.address,
    chain,
    name: pair.baseToken.name,
    symbol: pair.baseToken.symbol,
    decimals,
    supply,
    creator_address,`
);

fs.writeFileSync('src/ts/recon/shared.ts', code);
console.log("Fixed shared.ts");
