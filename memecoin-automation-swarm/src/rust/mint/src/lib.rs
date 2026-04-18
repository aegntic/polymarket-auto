use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use shared::redis_client::RedisPool;
use shared::{
    Chain, CloneStrategy, EventEnvelope, TokenAddress, TokenObservation,
    CHANNEL_MINT_DEPLOYED, CHANNEL_MINT_DEPLOY_REQUEST, CHANNEL_RECON_SIGNALS,
};
use tracing::{info, warn, error};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MintConfig {
    pub chain: Chain,
    pub network: shared::Network,
    pub max_clone_per_day: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloneSpec {
    pub original_token: TokenObservation,
    pub strategy: CloneStrategy,
    pub chain: Chain,
    pub network: shared::Network,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetadataBundle {
    pub name: String,
    pub symbol: String,
    pub description: String,
    pub logo_uri: Option<String>,
}

pub struct MintService {
    config: MintConfig,
    redis: RedisPool,
}

impl MintService {
    pub fn new(config: MintConfig, redis: RedisPool) -> Self {
        Self { config, redis }
    }

    pub fn generate_name_variant(original_name: &str, strategy: CloneStrategy) -> String {
        match strategy {
            CloneStrategy::Substitution => {
                let substitutions = [
                    ('o', '0'),
                    ('i', '1'),
                    ('l', '1'),
                    ('e', '3'),
                    ('a', '4'),
                    ('s', '5'),
                    ('t', '7'),
                    ('b', '8'),
                ];
                let mut result = original_name.to_string();
                for (from, to) in substitutions {
                    if result.contains(from) {
                        result = result.replacen(from, &to.to_string(), 1);
                        break;
                    }
                }
                result
            }
            CloneStrategy::Homophone => {
                let homophones = [
                    ("doge", "dogi"),
                    ("moon", "moon"),
                    ("pepe", "peppe"),
                    ("elon", "ellon"),
                    ("safe", "saife"),
                ];
                let lower = original_name.to_lowercase();
                for (from, to) in homophones {
                    if lower.contains(from) {
                        return lower.replacen(from, to, 1);
                    }
                }
                format!("{}_v2", original_name)
            }
            CloneStrategy::Suffix => {
                let suffixes = ["2", "pro", "plus", "x", "ai", "io", "vip"];
                let suffix = suffixes[original_name.len() % suffixes.len()];
                format!("{}{}", original_name, suffix)
            }
            CloneStrategy::Unicode => {
                let lookalikes = [
                    ('a', '\u{0430}'),
                    ('e', '\u{0435}'),
                    ('o', '\u{043E}'),
                    ('p', '\u{0440}'),
                    ('c', '\u{0441}'),
                    ('x', '\u{0445}'),
                ];
                let mut result = original_name.to_string();
                for (ascii, cyrillic) in lookalikes {
                    if result.contains(ascii) {
                        result = result.replacen(ascii, &cyrillic.to_string(), 1);
                        break;
                    }
                }
                result
            }
            CloneStrategy::Other => format!("{}_clone", original_name),
        }
    }

    pub fn generate_metadata(
        original: &TokenObservation,
        strategy: CloneStrategy,
    ) -> MetadataBundle {
        let name = Self::generate_name_variant(&original.name, strategy);
        let symbol = Self::generate_name_variant(&original.symbol, strategy);
        MetadataBundle {
            name,
            symbol: symbol.to_uppercase(),
            description: format!("Community token inspired by {}", original.name),
            logo_uri: original.logo_uri.clone(),
        }
    }

    pub async fn deploy_clone(&mut self, spec: CloneSpec) -> Result<TokenAddress> {
        let metadata = Self::generate_metadata(&spec.original_token, spec.strategy);

        info!(
            original = %spec.original_token.token_address,
            clone_name = %metadata.name,
            strategy = ?spec.strategy,
            "deploying clone token"
        );

        // In production: create SPL token on-chain via Solana RPC
        // For devnet: simulate with a random address
        let address = format!(
            "{}{}",
            metadata.name.replace(' ', ""),
            uuid::Uuid::new_v4()
                .to_string()
                .replace('-', "")
                .chars()
                .take(12)
                .collect::<String>()
        );

        let event = EventEnvelope::new(
            "mint",
            "clone_deployed",
            serde_json::json!({
                "clone_address": &address,
                "original_address": spec.original_token.token_address,
                "strategy": spec.strategy,
                "name": metadata.name,
                "symbol": metadata.symbol,
                "chain": spec.chain,
                "network": spec.network,
            }),
        );

        self.redis
            .publish(CHANNEL_MINT_DEPLOYED, &event)
            .await
            .context("failed to publish mint event")?;

        info!(clone_address = %address, "clone deployed");
        Ok(TokenAddress(address))
    }

    /// Subscribe to deploy requests and recon signals.
    /// Deploy requests trigger clone creation; high-signal recon events
    /// also trigger auto-deploy when signal_score >= 90.
    pub async fn start(&mut self) -> Result<()> {
        info!(
            chain = ?self.config.chain,
            network = ?self.config.network,
            max_per_day = self.config.max_clone_per_day,
            "MINT service starting subscriber loop"
        );

        let mut pubsub = self.redis.pubsub().await?;

        pubsub
            .subscribe(CHANNEL_MINT_DEPLOY_REQUEST)
            .await
            .context("failed to subscribe to deploy requests")?;
        pubsub
            .subscribe(CHANNEL_RECON_SIGNALS)
            .await
            .context("failed to subscribe to recon signals")?;

        use futures_util::StreamExt;
        let mut stream = pubsub.on_message();

        while let Some(msg) = stream.next().await {
            let channel: String = msg.get_channel()?;
            let data: String = msg.get_payload()?;

            let envelope: serde_json::Value = match serde_json::from_str(&data) {
                Ok(v) => v,
                Err(e) => {
                    warn!("Failed to parse message: {}", e);
                    continue;
                }
            };

            if channel == CHANNEL_RECON_SIGNALS {
                // Auto-deploy on high-signal recon events
                let event_type = envelope.get("event_type").and_then(|v| v.as_str()).unwrap_or("");
                if event_type != "signal_detected" {
                    continue;
                }
                let payload = match envelope.get("payload") {
                    Some(p) => p,
                    None => continue,
                };
                let signal_score = payload
                    .get("signal_score")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0);
                if signal_score < 90 {
                    continue;
                }

                let obs: TokenObservation = match serde_json::from_value(payload.clone()) {
                    Ok(o) => o,
                    Err(e) => {
                        warn!("Failed to deserialize TokenObservation: {}", e);
                        continue;
                    }
                };

                info!(
                    symbol = %obs.symbol,
                    score = signal_score,
                    "High-signal recon event triggers auto-deploy"
                );

                let spec = CloneSpec {
                    original_token: obs,
                    strategy: CloneStrategy::Suffix,
                    chain: self.config.chain,
                    network: self.config.network,
                };

                match self.deploy_clone(spec).await {
                    Ok(addr) => info!(address = %addr.0, "Auto-deployed clone"),
                    Err(e) => error!("Auto-deploy failed: {}", e),
                }
            } else if channel == CHANNEL_MINT_DEPLOY_REQUEST {
                // Explicit deploy request
                let payload = match envelope.get("payload").or_else(|| envelope.get("obs")) {
                    Some(p) => p,
                    None => continue,
                };
                let obs: TokenObservation = match serde_json::from_value(payload.clone()) {
                    Ok(o) => o,
                    Err(e) => {
                        warn!("Failed to deserialize deploy request: {}", e);
                        continue;
                    }
                };

                let strategy_str = envelope
                    .get("strategy")
                    .and_then(|v| v.as_str())
                    .unwrap_or("suffix");
                let strategy = match strategy_str {
                    "homophone" => CloneStrategy::Homophone,
                    "unicode" => CloneStrategy::Unicode,
                    "substitution" => CloneStrategy::Substitution,
                    _ => CloneStrategy::Suffix,
                };

                let spec = CloneSpec {
                    original_token: obs,
                    strategy,
                    chain: self.config.chain,
                    network: self.config.network,
                };

                match self.deploy_clone(spec).await {
                    Ok(addr) => info!(address = %addr.0, "Deployed clone from request"),
                    Err(e) => error!("Deploy request failed: {}", e),
                }
            }
        }

        Ok(())
    }
}
