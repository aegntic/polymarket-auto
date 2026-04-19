use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use shared::redis_client::RedisPool;
use shared::{CircuitBreakerLevel, EventEnvelope, CHANNEL_RISK_ALERTS};
use tracing::{error, info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskConfig {
    pub max_clone_per_day: u32,
    pub yellow_threshold_per_hour: u32,
    pub orange_threshold_per_hour: u32,
    pub llm_budget_usd_per_day: f64,
}

impl Default for RiskConfig {
    fn default() -> Self {
        Self {
            max_clone_per_day: 200,
            yellow_threshold_per_hour: 12,
            orange_threshold_per_hour: 25,
            llm_budget_usd_per_day: 10.0,
        }
    }
}

pub struct RiskService {
    config: RiskConfig,
    redis: RedisPool,
}

impl RiskService {
    pub fn new(config: RiskConfig, redis: RedisPool) -> Self {
        Self { config, redis }
    }

    pub async fn check_clone_allowed(&mut self) -> Result<bool> {
        let key = format!("mas:risk:clones:{}", chrono::Utc::now().format("%Y-%m-%d"));
        self.redis
            .increment_with_limit(&key, self.config.max_clone_per_day as u64, 86400)
            .await
            .context("failed to check clone limit")
    }

    pub async fn record_clone(&mut self) -> Result<()> {
        let key = format!("mas:risk:clones:{}", chrono::Utc::now().format("%Y-%m-%d"));
        self.redis
            .incr(&key)
            .await
            .context("failed to increment clone counter")?;
        Ok(())
    }

    pub async fn check_llm_budget(&mut self) -> Result<bool> {
        let key = format!(
            "mas:risk:llm_cost:{}",
            chrono::Utc::now().format("%Y-%m-%d")
        );
        let current: Option<String> = self.redis.get(&key).await?;
        let current_cost: f64 = current.and_then(|v| v.parse().ok()).unwrap_or(0.0);
        Ok(current_cost < self.config.llm_budget_usd_per_day)
    }

    pub async fn record_llm_cost(&mut self, cost_usd: f64) -> Result<()> {
        let key = format!(
            "mas:risk:llm_cost:{}",
            chrono::Utc::now().format("%Y-%m-%d")
        );
        self.redis
            .incr_by_float(&key, cost_usd)
            .await
            .context("failed to record LLM cost")?;
        Ok(())
    }

    pub async fn evaluate_circuit_breaker(&mut self) -> Result<CircuitBreakerLevel> {
        let hour_key = format!(
            "mas:clones:hourly:{}",
            chrono::Utc::now().format("%Y-%m-%d-%H")
        );
        let current: Option<String> = self.redis.get(&hour_key).await?;
        let count: u64 = current.and_then(|v| v.parse().ok()).unwrap_or(0);

        let level = if count >= self.config.orange_threshold_per_hour as u64 {
            CircuitBreakerLevel::Orange
        } else if count >= self.config.yellow_threshold_per_hour as u64 {
            CircuitBreakerLevel::Yellow
        } else {
            CircuitBreakerLevel::Green
        };

        if level != CircuitBreakerLevel::Green {
            warn!(level = ?level, hourly_count = count, "circuit breaker triggered");
            let event = EventEnvelope::new(
                "risk",
                "circuit_breaker",
                serde_json::json!({
                    "level": level,
                    "hourly_count": count,
                    "threshold_yellow": self.config.yellow_threshold_per_hour,
                    "threshold_orange": self.config.orange_threshold_per_hour,
                }),
            );
            let _ = self.redis.publish(CHANNEL_RISK_ALERTS, &event).await;
        }

        Ok(level)
    }

    pub async fn start(&mut self) -> Result<()> {
        info!(
            max_per_day = self.config.max_clone_per_day,
            budget = self.config.llm_budget_usd_per_day,
            "RISK service starting periodic circuit breaker evaluation"
        );

        // Subscribe to clone deployment events for rate tracking
        // and recon signals for observation volume (informational)
        let mut pubsub = self.redis.pubsub().await?;
        pubsub
            .subscribe(shared::CHANNEL_MINT_DEPLOYED)
            .await
            .context("failed to subscribe to mint deployed channel")?;
        pubsub
            .subscribe(shared::CHANNEL_RECON_SIGNALS)
            .await
            .context("failed to subscribe to recon signals")?;

        use futures_util::StreamExt;
        let mut stream = pubsub.on_message();
        let mut eval_interval = tokio::time::interval(tokio::time::Duration::from_secs(60));

        loop {
            tokio::select! {
                Some(msg) = stream.next() => {
                    let channel: Option<String> = msg.get_channel().ok();
                    match channel.as_deref() {
                        // Actual clone deployments -> count toward circuit breaker
                        Some(ch) if ch == shared::CHANNEL_MINT_DEPLOYED => {
                            let hour_key = format!(
                                "mas:clones:hourly:{}",
                                chrono::Utc::now().format("%Y-%m-%d-%H")
                            );
                            let day_key = format!(
                                "mas:clones:daily:{}",
                                chrono::Utc::now().format("%Y-%m-%d")
                            );
                            let _ = self.redis.incr(&hour_key).await;
                            let _ = self.redis.incr(&day_key).await;
                        }
                        // Recon signals -> observation volume (informational only)
                        Some(ch) if ch == shared::CHANNEL_RECON_SIGNALS => {
                            let hour_key = format!(
                                "mas:observations:hourly:{}",
                                chrono::Utc::now().format("%Y-%m-%d-%H")
                            );
                            let _ = self.redis.incr(&hour_key).await;
                        }
                        _ => {}
                    }
                }
                _ = eval_interval.tick() => {
                    match self.evaluate_circuit_breaker().await {
                        Ok(level) => {
                            if level != CircuitBreakerLevel::Green {
                                warn!(?level, "Circuit breaker status");
                            }
                        }
                        Err(e) => error!("Circuit breaker evaluation failed: {}", e),
                    }

                    // Check LLM budget
                    match self.check_llm_budget().await {
                        Ok(within_budget) => {
                            if !within_budget {
                                warn!("LLM daily budget exceeded");
                            }
                        }
                        Err(e) => error!("Budget check failed: {}", e),
                    }
                }
            }
        }
    }
}
