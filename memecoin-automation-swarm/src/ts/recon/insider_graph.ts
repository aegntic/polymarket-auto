import { Connection, PublicKey } from "@solana/web3.js";
import { getRedis } from "../shared/redis";
import * as ch from "../shared/clickhouse";

export class AlphaDiscoveryEngine {
  private redis = getRedis();
  private rpcUrl: string;

  constructor() {
    this.rpcUrl = process.env.HELIUS_API_KEY
      ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
      : "https://api.mainnet-beta.solana.com";
  }

  /**
   * Cron task: Identifies wallets that bought early into tokens that subsequently hit high MC.
   */
  async runDiscoveryCycle() {
    console.log(
      "[AlphaGraph] Running discovery cycle to find hidden burner wallets...",
    );

    try {
      // 1. Query ClickHouse for winning tokens (e.g. volume > $500k, market cap / fdv > $1M)
      const winners = await ch.query<{ token_address: string }>(`
        SELECT token_address 
        FROM clonet.token_observations 
        WHERE chain = 'solana' 
          AND volume_1h > 500000 
          AND initial_market_cap_usd > 1000000
        ORDER BY first_seen_at DESC 
        LIMIT 50
      `);

      if (winners.length === 0) {
        console.log(
          "[AlphaGraph] No recent winning tokens found in ClickHouse to trace.",
        );
        return;
      }

      console.log(
        `[AlphaGraph] Tracing early buyers for ${winners.length} winning tokens...`,
      );

      const walletScores: Record<string, number> = {};

      // 2. Extract early buyers for each winner
      for (const winner of winners) {
        const earlyBuyers = await this.getEarlyBuyers(winner.token_address);
        for (const buyer of earlyBuyers) {
          // Increment score if this wallet repeatedly appears in the first 10 buyers of *different* winners
          walletScores[buyer] = (walletScores[buyer] || 0) + 1;
        }
      }

      // 3. Filter and promote the actual Alpha wallets (Score >= 2 means they sniped multiple unrelated winners)
      let newAlphas = 0;
      for (const [wallet, score] of Object.entries(walletScores)) {
        if (score >= 2) {
          // Add to the Redis "mas:alpha_wallets" set.
          // The score is the ZSET score, allowing us to query top-tier insiders easily.
          await this.redis.zadd("mas:alpha_wallets", score, wallet);
          newAlphas++;
          console.log(
            `[AlphaGraph] Promoted Tier 1 Insider Wallet: ${wallet} (Win Score: ${score})`,
          );
        }
      }

      console.log(
        `[AlphaGraph] Cycle complete. Discovered ${newAlphas} new insider wallets.`,
      );
    } catch (e) {
      console.error("[AlphaGraph] Error during discovery cycle:", e);
    }
  }

  /**
   * Uses RPC to fetch the first few transactions of a token mint and parses out the buyer wallets.
   */
  private async getEarlyBuyers(mintAddress: string): Promise<string[]> {
    const buyers = new Set<string>();
    try {
      const connection = new Connection(this.rpcUrl, "confirmed");
      const pubkey = new PublicKey(mintAddress);

      // Get the earliest signatures (oldest first)
      const sigs = await connection.getSignaturesForAddress(pubkey, {
        limit: 20,
      });
      sigs.reverse(); // Order from oldest to newest

      // We only care about the absolute earliest buyers (block 0/1 snipers)
      const earliestSigs = sigs.slice(0, 10).map((s) => s.signature);

      const txs = await connection.getParsedTransactions(earliestSigs, {
        maxSupportedTransactionVersion: 0,
      });

      for (const tx of txs) {
        if (!tx || tx.meta?.err) continue; // Skip failed txs

        // The primary signer / fee payer is usually the sniper executing the buy
        const accountKeys = tx.transaction.message.accountKeys;
        if (accountKeys.length > 0) {
          const signer = accountKeys[0].pubkey.toString();

          // Filter out known MEV / Router bots (Jito, BananaGun, Raydium Authorities)
          // In production, this list would be extensive
          const KNOWN_ROUTERS = [
            "JitoTx1111111111111111111111111111111111111", // Jito Tip Router placeholder
            "routeUGWgWzqBWFcrCys8trmWHmPME8YtL2sHq6Zpump", // Common Pump Router
          ];

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
