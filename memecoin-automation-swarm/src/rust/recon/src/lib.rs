use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use shared::redis_client::RedisPool;
use shared::{
    Chain, EventEnvelope, SignalScore, TokenObservation,
    CHANNEL_RECON_SIGNALS,
};
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReconConfig {
    pub rpc_url: String,
    pub chain: Chain,
    pub network: shared::Network,
    pub signal_weights: SignalWeights,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalWeights {
    pub name_similarity: f64,
    pub metadata_match: f64,
    pub timing_proximity: f64,
    pub holder_pattern: f64,
    pub liquidity_ratio: f64,
}

impl Default for SignalWeights {
    fn default() -> Self {
        Self {
            name_similarity: 0.35,
            metadata_match: 0.25,
            timing_proximity: 0.15,
            holder_pattern: 0.15,
            liquidity_ratio: 0.10,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalFeatures {
    pub name_similarity_score: f64,
    pub metadata_match_score: f64,
    pub timing_score: f64,
    pub holder_score: f64,
    pub liquidity_score: f64,
}

pub struct ReconService {
    config: ReconConfig,
    redis: RedisPool,
}

impl ReconService {
    pub fn new(config: ReconConfig, redis: RedisPool) -> Self {
        Self { config, redis }
    }

    pub fn compute_signal_score(features: &SignalFeatures, weights: &SignalWeights) -> SignalScore {
        let raw = features.name_similarity_score * weights.name_similarity
            + features.metadata_match_score * weights.metadata_match
            + features.timing_score * weights.timing_proximity
            + features.holder_score * weights.holder_pattern
            + features.liquidity_score * weights.liquidity_ratio;

        let clamped = raw.clamp(0.0, 1.0);
        let score = (clamped * 100.0).round() as u8;
        SignalScore(score.min(100))
    }

    pub async fn process_token(&mut self, observation: TokenObservation) -> Result<SignalScore> {
        let features = self.extract_features(&observation);
        let score = Self::compute_signal_score(&features, &self.config.signal_weights);

        let event = EventEnvelope::new(
            "recon",
            "signal_detected",
            serde_json::to_value(&observation)?,
        );

        self.redis
            .publish(CHANNEL_RECON_SIGNALS, &event)
            .await
            .context("failed to publish recon signal")?;

        info!(
            token = %observation.token_address,
            score = score.value(),
            "signal scored"
        );

        Ok(score)
    }

    fn extract_features(&self, obs: &TokenObservation) -> SignalFeatures {
        SignalFeatures {
            name_similarity_score: 0.0,
            metadata_match_score: 0.0,
            timing_score: 0.0,
            holder_score: obs.holder_count_1h.map(|h| (h as f64 / 100.0).min(1.0)).unwrap_or(0.0),
            liquidity_score: obs.initial_liquidity_sol.map(|l| (l / 100.0).min(1.0)).unwrap_or(0.0),
        }
    }

    pub async fn start(&mut self) -> Result<()> {
        info!(chain = %self.config.chain, "RECON service starting");
        // In production: subscribe to Solana geyser/websocket for new token events
        // For now, signals are processed via process_token() calls from the control plane
        Ok(())
    }
}
