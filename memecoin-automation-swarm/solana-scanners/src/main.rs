use alpha_wallets_phase0::aggregator::helius::HeliusClient;
use alpha_wallets_phase0::config::Config;
use alpha_wallets_phase0::filters::red_flag::has_red_flags;
use std::time::Duration;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_target(false)
        .with_max_level(tracing::Level::INFO)
        .init();

    let config = Config::load()?;
    let client = HeliusClient::new(config.helius_api_key.clone());

    println!("alpha-wallets Phase 1 — Live Helius Ingestion");
    println!("Polling {} wallets every {}s\n", config.known_wallets.len(), config.poll_interval_secs);

    loop {
        let now = chrono_now();
        println!("═══ Poll cycle at {} ═══", now);

        match client.get_active_wallets(&config.known_wallets, 1, 0.0).await {
            Ok(wallets) => {
                for w in &wallets {
                    let flags = has_red_flags(&w.address, &w.recent_txs);

                    println!("Wallet: {}", w.address);
                    println!("  Trades (14d): {}", w.trade_count_14d);
                    println!("  SOL balance:  {:.4}", w.sol_balance);
                    println!("  Recent txs:   {}", w.recent_txs.len());

                    if !flags.is_empty() {
                        println!("  ⚠  Red flags: {:?}", flags);
                    }

                    // Show last 3 transactions
                    for tx in w.recent_txs.iter().take(3) {
                        println!("    {} {:?} {:.6} SOL {}",
                            &tx.signature[..16],
                            tx.tx_type,
                            tx.amount_sol,
                            tx.token_mint.as_ref().map(|m| m.as_str()).unwrap_or("SOL")
                        );
                    }
                    println!();
                }
                println!("{} active wallets this cycle", wallets.len());
            }
            Err(e) => {
                tracing::error!(error = %e, "poll cycle failed");
            }
        }

        println!();
        tokio::time::sleep(Duration::from_secs(config.poll_interval_secs)).await;
    }
}

fn chrono_now() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    format!("{}s since epoch", secs)
}
