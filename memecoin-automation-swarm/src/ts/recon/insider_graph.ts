import { Connection, PublicKey } from "@solana/web3.js";
import { getRedis } from "../shared/redis";
import * as ch from "../shared/clickhouse";
import { DEXSCREENER_API, fetchTokenProfiles } from "./shared";

// H4: Singleton connection for AlphaDiscoveryEngine
let alphaConnection: Connection | null = null;

// Known MEV/bot addresses to exclude from alpha wallet promotion
const KNOWN_ROUTERS = [
  "JitoTx1111111111111111111111111111111111111",
  "routeUGWgWzqBWFcrCys8trmWHmPME8YtL2sHq6Zpump",
];

export class AlphaDiscoveryEngine {
  private redis = getRedis();
  private rpcUrl: string;

  constructor() {
    this.rpcUrl = process.env.HELIUS_API_KEY
      ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
      : "https://api.mainnet-beta.solana.com";
  }

  private getConnection(): Connection {
    if (!alphaConnection) {
      alphaConnection = new Connection(this.rpcUrl, "confirmed");
    }
    return alphaConnection;
  }

  /**
   * Main discovery cycle. Tries ClickHouse first, falls back to DexScreener trending.
   */
  async runDiscoveryCycle() {
    console.log(
      "[AlphaGraph] Running discovery cycle to find hidden burner wallets...",
    );

    try {
      // Check if we already have alpha wallets — skip if we have enough
      const existingCount = await this.redis.zcard("mas:alpha_wallets");
      if (existingCount >= 50) {
        console.log(
          `[AlphaGraph] Already tracking ${existingCount} alpha wallets. Skipping discovery.`,
        );
        return;
      }

      // 1. Try ClickHouse first (requires accumulated data)
      const winners = await ch.query<{ token_address: string }>(
        `SELECT token_address
         FROM clonet.token_observations
         WHERE chain = 'solana'
           AND volume_1h > 500000
           AND initial_market_cap_usd > 1000000
         ORDER BY first_seen_at DESC
         LIMIT 50`,
      );

      let tokenAddresses: string[];

      if (winners.length > 0) {
        tokenAddresses = winners.map((w) => w.token_address);
        console.log(
          `[AlphaGraph] Found ${tokenAddresses.length} winning tokens in ClickHouse.`,
        );
      } else {
        // 2. Cold-start fallback: bootstrap from DexScreener trending tokens
        console.log(
          "[AlphaGraph] No winning tokens in ClickHouse. Bootstrapping from DexScreener trending...",
        );
        tokenAddresses = await this.bootstrapFromTrending();
        if (tokenAddresses.length === 0) {
          console.log(
            "[AlphaGraph] No trending tokens found. Will retry next cycle.",
          );
          return;
        }
      }

      await this.traceAndPromote(tokenAddresses);
    } catch (e) {
      console.error("[AlphaGraph] Error during discovery cycle:", e);
    }
  }

  /**
   * Cold-start fallback: fetch trending tokens from DexScreener and extract
   * their token addresses for alpha wallet tracing.
   */
  private async bootstrapFromTrending(): Promise<string[]> {
    const addresses: string[] = [];
    try {
      const profiles = await fetchTokenProfiles("solana");
      // Filter to tokens on Solana with meaningful presence
      for (const profile of profiles.slice(0, 30)) {
        if (
          profile.tokenAddress &&
          profile.tokenAddress !== "undefined" &&
          profile.tokenAddress.length > 30
        ) {
          addresses.push(profile.tokenAddress);
        }
      }

      // Supplement with DexScreener search for high-volume tokens
      const queries = ["pepe", "dog", "cat", "bonk", "hat"];
      for (const q of queries) {
        try {
          const resp = await fetch(
            `${DEXSCREENER_API}/latest/dex/search?q=${q}`,
          );
          const data = (await resp.json()) as {
            pairs: {
              baseToken: { address: string };
              chainId: string;
              fdv: number | null;
              volume: { h1: number };
            }[];
          };
          const highVol = (data.pairs || [])
            .filter(
              (p) =>
                p.chainId === "solana" &&
                p.fdv &&
                p.fdv > 500000 &&
                p.volume?.h1 > 50000,
            )
            .slice(0, 5);
          for (const p of highVol) {
            if (!addresses.includes(p.baseToken.address)) {
              addresses.push(p.baseToken.address);
            }
          }
        } catch {
          // Skip failed queries
        }
      }

      console.log(
        `[AlphaGraph] Bootstrap collected ${addresses.length} trending token addresses.`,
      );
    } catch (e) {
      console.error(
        "[AlphaGraph] Bootstrap failed:",
        e instanceof Error ? e.message : e,
      );
    }
    return addresses;
  }

  /**
   * Trace early buyers for a list of token addresses and promote recurring ones.
   */
  private async traceAndPromote(tokenAddresses: string[]): Promise<void> {
    console.log(
      `[AlphaGraph] Tracing early buyers for ${tokenAddresses.length} tokens...`,
    );

    const walletScores: Record<string, number> = {};

    for (const address of tokenAddresses) {
      const earlyBuyers = await this.getEarlyBuyers(address);
      for (const buyer of earlyBuyers) {
        walletScores[buyer] = (walletScores[buyer] || 0) + 1;
      }
    }

    // Promote wallets that appear in early buyers of 2+ different tokens
    let newAlphas = 0;
    for (const [wallet, score] of Object.entries(walletScores)) {
      if (score >= 2) {
        await this.redis.zadd("mas:alpha_wallets", score, wallet);
        newAlphas++;
        console.log(
          `[AlphaGraph] Promoted Tier 1 Insider Wallet: ${wallet} (Win Score: ${score})`,
        );
      }
    }

    console.log(
      `[AlphaGraph] Cycle complete. Discovered ${newAlphas} new insider wallets. Total: ${await this.redis.zcard("mas:alpha_wallets")}`,
    );
  }

  /**
   * Uses RPC to fetch the first few transactions of a token mint and parses out the buyer wallets.
   */
  private async getEarlyBuyers(mintAddress: string): Promise<string[]> {
    const buyers = new Set<string>();
    try {
      const connection = this.getConnection();
      const pubkey = new PublicKey(mintAddress);

      const sigs = await connection.getSignaturesForAddress(pubkey, {
        limit: 20,
      });
      sigs.reverse(); // Order from oldest to newest

      const earliestSigs = sigs.slice(0, 10).map((s) => s.signature);

      const txs = await connection.getParsedTransactions(earliestSigs, {
        maxSupportedTransactionVersion: 0,
      });

      for (const tx of txs) {
        if (!tx || tx.meta?.err) continue;

        const accountKeys = tx.transaction.message.accountKeys;
        if (accountKeys.length > 0) {
          const signer = accountKeys[0].pubkey.toString();

          if (!KNOWN_ROUTERS.includes(signer)) {
            buyers.add(signer);
          }
        }
      }
    } catch (e) {
      console.error(
        `[AlphaGraph] Failed to fetch early buyers for ${mintAddress}:`,
        (e as Error).message,
      );
    }

    return Array.from(buyers);
  }
}
