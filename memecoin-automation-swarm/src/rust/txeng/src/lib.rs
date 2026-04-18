use anyhow::{Context, Result};
use shared::redis_client::RedisPool;
use shared::{
    Chain, CloneStrategy, EventEnvelope, TokenObservation,
    CHANNEL_MINT_DEPLOY_REQUEST, CHANNEL_DETECT_RESULTS, CHANNEL_TXENG_STATUS,
};
use tracing::{info, warn, error};

/// Transaction Engine Service
///
/// Listens to detect results and routes deployment requests to the mint service.
/// This is the orchestrator between detection and minting.
pub struct TxEngService {
    redis: RedisPool,
}

impl TxEngService {
    pub fn new(redis: RedisPool) -> Self {
        Self { redis }
    }

    /// Request a clone deployment for the given token.
    /// Publishes to CHANNEL_MINT_DEPLOY_REQUEST for the mint service to pick up.
    pub async fn request_deploy(
        &mut self,
        obs: &TokenObservation,
        strategy: CloneStrategy,
    ) -> Result<()> {
        let event = EventEnvelope::new(
            "txeng",
            "deploy_request",
            serde_json::json!({
                "obs": obs,
                "strategy": format!("{:?}", strategy).to_lowercase(),
            }),
        );

        self.redis
            .publish(CHANNEL_MINT_DEPLOY_REQUEST, &event)
            .await
            .context("failed to publish deploy request")?;

        info!(
            symbol = %obs.symbol,
            strategy = ?strategy,
            "Published deploy request to mint service"
        );
        Ok(())
    }

    /// Submit a raw transaction for the given chain.
    /// Currently publishes status to Redis. Full on-chain submission via
    /// Solana JSON-RPC will be added in a follow-up.
    pub fn submit_transaction(chain: Chain, payload: &[u8]) -> Result<String> {
        // Future: use reqwest to call Solana JSON-RPC sendTransaction
        // For now, return a placeholder tx signature
        let sig = format!(
            "{}_{:016x}",
            match chain {
                Chain::Solana => "sol",
                Chain::Base => "base",
                Chain::Bnb => "bnb",
            },
            // Simple hash of payload for deterministic testing
            payload.iter().fold(0u64, |acc, &b| acc.wrapping_mul(31).wrapping_add(b as u64))
        );
        Ok(sig)
    }

    /// Start the subscriber loop.
    /// Listens to detect results and auto-routes clones for deployment.
    pub async fn start(&mut self) -> Result<()> {
        info!("TXENG service starting subscriber loop");

        let mut pubsub = self.redis.pubsub().await?;
        pubsub
            .subscribe(CHANNEL_DETECT_RESULTS)
            .await
            .context("failed to subscribe to detect results")?;

        use futures_util::StreamExt;
        let mut stream = pubsub.on_message();

        while let Some(msg) = stream.next().await {
            let data: String = match msg.get_payload() {
                Ok(d) => d,
                Err(e) => {
                    warn!("Failed to get message payload: {}", e);
                    continue;
                }
            };

            let envelope: serde_json::Value = match serde_json::from_str(&data) {
                Ok(v) => v,
                Err(e) => {
                    warn!("Failed to parse detect result: {}", e);
                    continue;
                }
            };

            let event_type = envelope
                .get("event_type")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            if event_type != "classification_result" {
                continue;
            }

            let payload = match envelope.get("payload") {
                Some(p) => p,
                None => continue,
            };

            let classification = payload
                .get("classification")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            if classification != "clone" {
                continue;
            }

            let confidence = payload
                .get("confidence")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0);

            if confidence < 0.7 {
                info!(
                    classification,
                    confidence,
                    "Clone detected but confidence too low for auto-deploy"
                );
                continue;
            }

            // Extract the original token observation
            let obs: TokenObservation = match serde_json::from_value(payload.clone()) {
                Ok(o) => o,
                Err(e) => {
                    warn!("Failed to deserialize token observation: {}", e);
                    continue;
                }
            };

            let strategy_str = payload
                .get("clone_strategy")
                .and_then(|v| v.as_str())
                .unwrap_or("suffix");
            let strategy = match strategy_str {
                "homophone" => CloneStrategy::Homophone,
                "unicode" => CloneStrategy::Unicode,
                "substitution" => CloneStrategy::Substitution,
                _ => CloneStrategy::Suffix,
            };

            info!(
                symbol = %obs.symbol,
                confidence,
                strategy = ?strategy,
                "Routing clone for deployment"
            );

            if let Err(e) = self.request_deploy(&obs, strategy).await {
                error!("Failed to request deploy: {}", e);
            }

            // Publish txeng status
            let status_event = EventEnvelope::new(
                "txeng",
                "routed",
                serde_json::json!({
                    "token_address": obs.token_address,
                    "symbol": obs.symbol,
                    "confidence": confidence,
                }),
            );
            let _ = self.redis.publish(CHANNEL_TXENG_STATUS, &status_event).await;
        }

        Ok(())
    }
}
