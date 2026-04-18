use anyhow::{bail, Context, Result};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use shared::redis_client::RedisPool;
use shared::{EventEnvelope, CHANNEL_ECONOMY_SETTLED};
use tracing::{error, info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EconomyConfig {
    pub llm_budget_usd_per_day: f64,
    pub settlement_key: String,
}

impl Default for EconomyConfig {
    fn default() -> Self {
        Self {
            llm_budget_usd_per_day: 10.0,
            settlement_key: "mas:economy:ledger".to_string(),
        }
    }
}

pub struct EconomyService {
    config: EconomyConfig,
    redis: RedisPool,
}

impl EconomyService {
    pub fn new(config: EconomyConfig, redis: RedisPool) -> Self {
        Self { config, redis }
    }

    /// Atomically transfer SOL-denominated profit from a token's pending balance
    /// to the main settlement ledger using the Redis Lua ledger script.
    pub async fn settle_profit(&mut self, token_address: &str, amount_sol: i64) -> Result<()> {
        let from_key = format!("mas:economy:pending:{}", token_address);
        let to_key = &self.config.settlement_key;

        let success = self
            .redis
            .atomic_ledger_transfer(&from_key, to_key, amount_sol)
            .await
            .context("settlement ledger transfer failed")?;

        if !success {
            bail!(
                "insufficient pending balance for token {} (requested {} lamports)",
                token_address,
                amount_sol
            );
        }

        info!(
            token = token_address,
            amount_lamports = amount_sol,
            "settlement transferred to ledger"
        );

        let event = EventEnvelope::new(
            "economy",
            "profit_settled",
            serde_json::json!({
                "token_address": token_address,
                "amount_lamports": amount_sol,
            }),
        );
        let _ = self.redis.publish(CHANNEL_ECONOMY_SETTLED, &event).await;

        Ok(())
    }

    /// Returns `true` if the cumulative LLM cost today is still within the
    /// configured daily budget.
    pub async fn check_budget(&mut self) -> Result<bool> {
        let key = format!(
            "mas:economy:llm_cost:{}",
            chrono::Utc::now().format("%Y-%m-%d")
        );
        let current: Option<String> = self.redis.get(&key).await?;
        let current_cost: f64 = current.and_then(|v| v.parse().ok()).unwrap_or(0.0);
        Ok(current_cost < self.config.llm_budget_usd_per_day)
    }

    /// Increment the daily LLM cost counter by `cost_usd`.
    pub async fn record_cost(&mut self, cost_usd: f64) -> Result<()> {
        let key = format!(
            "mas:economy:llm_cost:{}",
            chrono::Utc::now().format("%Y-%m-%d")
        );
        self.redis
            .incr_by_float(&key, cost_usd)
            .await
            .context("failed to record LLM cost")?;

        info!(cost_usd, "LLM cost recorded");

        let within = self.check_budget().await.unwrap_or(true);
        if !within {
            warn!(
                budget = self.config.llm_budget_usd_per_day,
                "daily LLM budget exceeded"
            );
        }

        Ok(())
    }

    /// Main entry point: subscribes to `CHANNEL_ECONOMY_SETTLED` for incoming
    /// settlement requests and runs a periodic budget check every 60 seconds.
    pub async fn start(&mut self) -> Result<()> {
        info!(
            budget = self.config.llm_budget_usd_per_day,
            ledger_key = %self.config.settlement_key,
            "ECONOMY service starting"
        );

        let mut pubsub = self.redis.pubsub().await?;
        pubsub
            .subscribe(CHANNEL_ECONOMY_SETTLED)
            .await
            .context("failed to subscribe to economy channel")?;

        info!(channel = CHANNEL_ECONOMY_SETTLED, "subscribed to settlement channel");

        let mut message_stream = pubsub.on_message();
        let mut budget_interval = tokio::time::interval(tokio::time::Duration::from_secs(60));

        loop {
            tokio::select! {
                maybe_msg = message_stream.next() => {
                    match maybe_msg {
                        Some(msg) => {
                            let payload: Result<String, _> = msg.get_payload();
                            match payload {
                                Ok(raw) => {
                                    if let Err(e) = self.handle_settlement_message(&raw).await {
                                        error!(error = %e, "failed to process settlement message");
                                    }
                                }
                                Err(e) => {
                                    error!(error = %e, "failed to extract pubsub payload");
                                }
                            }
                        }
                        None => {
                            warn!("pubsub stream ended, attempting reconnect");
                            break;
                        }
                    }
                }
                _ = budget_interval.tick() => {
                    if let Err(e) = self.periodic_budget_check().await {
                        error!(error = %e, "periodic budget check failed");
                    }
                }
            }
        }

        Ok(())
    }

    async fn handle_settlement_message(&mut self, raw: &str) -> Result<()> {
        let envelope: EventEnvelope = serde_json::from_str(raw)
            .context("failed to deserialize economy settlement envelope")?;

        let token_address = envelope.payload["token_address"]
            .as_str()
            .unwrap_or("")
            .to_string();
        let amount_sol = envelope.payload["amount_lamports"]
            .as_i64()
            .unwrap_or(0);

        if token_address.is_empty() || amount_sol <= 0 {
            warn!(
                token = %token_address,
                amount = amount_sol,
                "ignoring settlement with missing or invalid fields"
            );
            return Ok(());
        }

        self.settle_profit(&token_address, amount_sol).await
    }

    async fn periodic_budget_check(&mut self) -> Result<()> {
        let within = self.check_budget().await?;
        if !within {
            warn!(
                budget = self.config.llm_budget_usd_per_day,
                "daily LLM budget exceeded — circuit breaker should throttle"
            );
        } else {
            info!("periodic budget check: within limits");
        }
        Ok(())
    }
}
