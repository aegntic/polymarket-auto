import { fetchSolanaTokenInfo, fetchEvmTokenInfo } from "./rpc";
import { Chain, TokenObservation } from "../shared/types";
import { nameSimilarity } from "../detect/classifier";

export const DEXSCREENER_API = "https://api.dexscreener.com";

export interface DexPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd: string | null;
  volume: { h24: number; h6: number; h1: number; m5: number };
  liquidity: { usd: number; base: number; quote: number } | null;
  fdv: number | null;
  pairCreatedAt: number | null;
  txns: {
    h24: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h1: { buys: number; sells: number };
  };
  priceChange: { h24: number; h6: number; h1: number; m5: number } | null;
}

export interface DexTokenProfile {
  tokenAddress: string;
  chainId: string;
  description: string;
}

export const KNOWN_MEMECOINS = [
  "pepe",
  "dogecoin",
  "shiba inu",
  "floki",
  "bonk",
  "dogwifhat",
  "wif",
  "bome",
  "mog",
  "turbouo",
  "book of meme",
  "pewdiepie",
  "mother",
  "andy",
  "landwolf",
  "michi",
  "wen",
  "myro",
  "cope",
  "ocean",
  "silly dragon",
  "popcat",
  "cat in a dogs world",
  "maneki",
  "gigachad",
  "brett",
  "toshi",
  "friend.tech",
  "key",
  "jeo boden",
  "tremp",
  "polymarket",
  "elysia",
  "chain-gang",
  "wildfrog",
  "glorb",
  "nubcat",
  "moo deng",
  "goat",
  "spx6900",
  "fwog",
  "gnon",
  "sunwukong",
  "cntr",
  "pnut",
];

export function mapChain(chainId: string): Chain | null {
  if (chainId === "solana") return "solana";
  if (chainId === "base") return "base";
  if (chainId === "bsc") return "bnb";
  return null; // unsupported chain
}

// H2: Fetch with retry and backoff for rate-limited APIs
async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const resp = await fetch(url);
    if (resp.status === 429 || resp.status >= 500) {
      const delay = 1000 * Math.pow(2, attempt);
      console.warn(
        `[DexScreener] Rate limited (${resp.status}), retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`,
      );
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    return resp;
  }
  throw new Error(`DexScreener API failed after ${retries} retries for ${url}`);
}

export async function fetchLatestTokens(chain?: string): Promise<DexPair[]> {
  const chains = chain ? [chain] : ["solana", "base"];
  const queries = ["pump", "inu", "pepe", "cat", "dog", "frog", "bonk", "hat"];

  const allPairs: DexPair[] = [];

  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
  for (const _c of chains) {
    for (const q of queries.slice(0, 3)) {
      try {
        const resp = await fetchWithRetry(`${DEXSCREENER_API}/latest/dex/search?q=${q}`);
        const data = (await resp.json()) as { pairs: DexPair[] };
        const filtered = (data.pairs || []).filter((p) =>
          chains.includes(p.chainId),
        );
        allPairs.push(...filtered);
      } catch (err) {
        console.warn(`[DexScreener] Failed to fetch query "${q}":`, err instanceof Error ? err.message : err);
      }
    }
  }

  const seen = new Set<string>();
  return allPairs.filter((p) => {
    const key = `${p.chainId}:${p.baseToken.address}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function fetchTokenProfiles(
  chain: string,
): Promise<DexTokenProfile[]> {
  try {
    const resp = await fetchWithRetry(`${DEXSCREENER_API}/token-profiles/latest/v1`);
    const data = (await resp.json()) as DexTokenProfile[];
    return data.filter((t) => !chain || t.chainId === chain);
  } catch (err) {
    console.warn("[DexScreener] Failed to fetch token profiles:", err instanceof Error ? err.message : err);
    return [];
  }
}

export async function pairToObservation(
  pair: DexPair,
): Promise<TokenObservation | null> {
  const chain = mapChain(pair.chainId);
  if (!chain) return null;
  const vol = pair.volume || { h24: 0, h6: 0, h1: 0, m5: 0 };
  const txns = pair.txns?.h24 || { buys: 0, sells: 0 };

  let decimals = chain === "solana" ? 9 : 18;
  let creator_address = "";
  let supply = "";

  if (chain === "solana") {
    const info = await fetchSolanaTokenInfo(
      pair.baseToken.address,
      process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
    );
    decimals = info.decimals;
    creator_address = info.creator_address;
    supply = info.supply;
  } else if (chain === "base") {
    const info = await fetchEvmTokenInfo(
      pair.baseToken.address,
      process.env.BASE_RPC_URL || "https://mainnet.base.org",
    );
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

    creation_tx: "",
    created_at: pair.pairCreatedAt
      ? new Date(pair.pairCreatedAt)
          .toISOString()
          .replace("T", " ")
          .slice(0, 19)
      : new Date().toISOString().replace("T", " ").slice(0, 19),
    metadata_uri: "",
    logo_uri: "",
    initial_liquidity_sol: pair.liquidity?.base || 0,
    initial_market_cap_usd: pair.fdv || 0,
    holder_count_1h: txns.buys + txns.sells,
    volume_1h: vol.h1,
    signal_score: 0,
  };
}

export function quickScreen(token: TokenObservation): {
  isClone: boolean;
  similarity: number;
  match: string;
} {
  const nameLower = token.name.toLowerCase();
  let maxSim = 0;
  let bestMatch = "";

  for (const known of KNOWN_MEMECOINS) {
    const sim = nameSimilarity(nameLower, known);
    if (sim > maxSim) {
      maxSim = sim;
      bestMatch = known;
    }
  }

  return { isClone: maxSim > 0.7, similarity: maxSim, match: bestMatch };
}
