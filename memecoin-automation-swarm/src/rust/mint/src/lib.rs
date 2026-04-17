use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use shared::redis_client::RedisPool;
use shared::{
    Chain, CloneStrategy, EventEnvelope, TokenAddress, TokenObservation, CHANNEL_MINT_DEPLOYED,
};
use tracing::{info, warn};

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
}
