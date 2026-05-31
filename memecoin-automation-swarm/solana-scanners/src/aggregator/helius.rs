use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

// ── Helius API response types ──

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeliusTransaction {
    pub signature: String,
    pub timestamp: u64,
    pub description: String,
    pub fee: u64,
    pub fee_payer: String,
    pub native_transfers: Option<Vec<NativeTransfer>>,
    pub token_transfers: Option<Vec<TokenTransfer>>,
    #[serde(rename = "type")]
    pub transaction_type: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeTransfer {
    pub from_user_account: String,
    pub to_user_account: String,
    pub amount: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenTransfer {
    pub from_user_account: String,
    pub to_user_account: String,
    pub mint: String,
    pub token_amount: f64,
}

// ── Internal shared types ──

#[derive(Debug, Clone, Serialize)]
pub enum TxType {
    Swap,
    Transfer,
    LpAction,
    Unknown,
}

#[derive(Debug, Clone, Serialize)]
pub struct TxSummary {
    pub signature: String,
    pub timestamp: u64,
    pub token_mint: Option<String>,
    pub amount_sol: f64,
    pub tx_type: TxType,
}

#[derive(Debug, Clone, Serialize)]
pub struct WalletActivity {
    pub address: String,
    pub trade_count_14d: u32,
    pub sol_balance: f64,
    pub recent_txs: Vec<TxSummary>,
    pub last_updated: u64,
}

pub struct HeliusClient {
    client: Client,
    api_key: String,
    base_url: String,
}

impl HeliusClient {
    pub fn new(api_key: String) -> Self {
        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .expect("failed to build reqwest client"),
            api_key,
            base_url: "https://api.helius.xyz".to_string(),
        }
    }

    /// Fetch enhanced transactions for an address
    pub async fn fetch_transactions(&self, address: &str, limit: usize) -> Result<Vec<HeliusTransaction>> {
        let url = format!(
            "{}/v0/addresses/{}/transactions?api-key={}",
            self.base_url, address, self.api_key
        );

        let resp = self.client.get(&url).send().await
            .context("Helius transactions request failed")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Helius API error {}: {}", status, body);
        }

        let txs: Vec<HeliusTransaction> = resp.json().await
            .context("Failed to parse Helius transaction response")?;

        Ok(txs.into_iter().take(limit).collect())
    }

    /// Fetch SOL balance via JSON-RPC
    pub async fn fetch_balance(&self, address: &str) -> Result<f64> {
        let url = format!(
            "https://mainnet.helius-rpc.com/?api-key={}",
            self.api_key
        );

        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getBalance",
            "params": [address]
        });

        let resp = self.client.post(&url).json(&body).send().await
            .context("Helius balance RPC failed")?;

        let parsed: serde_json::Value = resp.json().await
            .context("Failed to parse balance response")?;

        let lamports = parsed["result"]["value"]
            .as_u64()
            .unwrap_or(0);

        Ok(lamports as f64 / 1_000_000_000.0)
    }

    /// Aggregate activity for a list of wallet addresses
    pub async fn get_active_wallets(
        &self,
        addresses: &[String],
        min_trades: u32,
        min_sol: f64,
    ) -> Result<Vec<WalletActivity>> {
        let mut active = Vec::new();

        for addr in addresses {
            match self.poll_wallet(addr).await {
                Ok(Some(activity)) => {
                    if activity.trade_count_14d >= min_trades && activity.sol_balance >= min_sol {
                        active.push(activity);
                    }
                }
                Ok(None) => {
                    tracing::warn!(address = %addr, "no activity data returned");
                }
                Err(e) => {
                    tracing::error!(address = %addr, error = %e, "failed to poll wallet");
                }
            }
        }

        Ok(active)
    }

    /// Poll a single wallet: fetch transactions + balance
    pub async fn poll_wallet(&self, address: &str) -> Result<Option<WalletActivity>> {
        let txs = self.fetch_transactions(address, 50).await?;
        let sol_balance = self.fetch_balance(address).await.unwrap_or(0.0);
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let fourteen_days_ago = now - (14 * 24 * 60 * 60);
        let mut recent_txs = Vec::new();
        let mut trade_count = 0u32;

        for tx in &txs {
            if tx.timestamp < fourteen_days_ago {
                continue;
            }

            let tx_type = classify_tx(&tx.transaction_type);
            let amount_sol = tx.fee as f64 / 1_000_000_000.0;

            // Sum native transfers involving this wallet for SOL amount
            let sol_amount = if let Some(ref transfers) = tx.native_transfers {
                transfers.iter()
                    .filter(|t| t.from_user_account == address || t.to_user_account == address)
                    .map(|t| t.amount as f64 / 1_000_000_000.0)
                    .sum::<f64>()
                    .max(amount_sol)
            } else {
                amount_sol
            };

            let token_mint = tx.token_transfers.as_ref().and_then(|tt| {
                tt.first().map(|t| t.mint.clone())
            });

            if matches!(tx_type, TxType::Swap | TxType::LpAction) {
                trade_count += 1;
            }

            recent_txs.push(TxSummary {
                signature: tx.signature.clone(),
                timestamp: tx.timestamp,
                token_mint,
                amount_sol: sol_amount,
                tx_type,
            });
        }

        if recent_txs.is_empty() && sol_balance == 0.0 {
            return Ok(None);
        }

        Ok(Some(WalletActivity {
            address: address.to_string(),
            trade_count_14d: trade_count,
            sol_balance,
            recent_txs,
            last_updated: now,
        }))
    }
}

fn classify_tx(tx_type: &str) -> TxType {
    let lower = tx_type.to_lowercase();
    if lower.contains("swap") {
        TxType::Swap
    } else if lower.contains("transfer") {
        TxType::Transfer
    } else if lower.contains("liquidity") || lower.contains("lp") {
        TxType::LpAction
    } else {
        TxType::Unknown
    }
}
