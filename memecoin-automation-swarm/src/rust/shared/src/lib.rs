pub mod clickhouse;
pub mod redis_client;

#[cfg(test)]
mod lib_tests;

use serde::{Deserialize, Serialize};
use std::fmt;

// --- Core Types ---

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Chain {
    Solana,
    Base,
    Bnb,
}

impl fmt::Display for Chain {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Chain::Solana => write!(f, "solana"),
            Chain::Base => write!(f, "base"),
            Chain::Bnb => write!(f, "bnb"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Network {
    Devnet,
    Testnet,
    Mainnet,
}

impl fmt::Display for Network {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Network::Devnet => write!(f, "devnet"),
            Network::Testnet => write!(f, "testnet"),
            Network::Mainnet => write!(f, "mainnet"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TokenAddress(pub String);

impl TokenAddress {
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct SignalScore(pub u8);

impl SignalScore {
    pub fn value(&self) -> u8 {
        self.0
    }

    pub fn is_high(&self) -> bool {
        self.0 >= 70
    }
}

impl TryFrom<u8> for SignalScore {
    type Error = anyhow::Error;
    fn try_from(v: u8) -> Result<Self, Self::Error> {
        if v > 100 {
            anyhow::bail!("SignalScore must be 0-100, got {}", v)
        }
        Ok(SignalScore(v))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Classification {
    Clone,
    Original,
    Unknown,
}

impl fmt::Display for Classification {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Classification::Clone => write!(f, "clone"),
            Classification::Original => write!(f, "original"),
            Classification::Unknown => write!(f, "unknown"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CloneStrategy {
    Substitution,
    Homophone,
    Suffix,
    Unicode,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CircuitBreakerLevel {
    Green,
    Yellow,
    Orange,
    Red,
}

// --- Domain Structs ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenObservation {
    pub token_address: String,
    pub chain: Chain,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub supply: Option<String>,
    pub creator_address: Option<String>,
    pub creation_tx: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub metadata_uri: Option<String>,
    pub logo_uri: Option<String>,
    pub initial_liquidity_sol: Option<f64>,
    pub initial_market_cap_usd: Option<f64>,
    pub holder_count_1h: Option<u32>,
    pub volume_1h: Option<f64>,
    pub signal_score: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassificationResult {
    pub token_address: String,
    pub chain: Chain,
    pub classification: Classification,
    pub confidence: f64,
    pub clone_strategy: Option<CloneStrategy>,
    pub original_token: Option<String>,
    pub reasoning: String,
    pub model_used: Option<String>,
    pub classified_at: chrono::DateTime<chrono::Utc>,
    pub cost_usd: f64,
}

// --- Redis Event Envelope ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventEnvelope {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub module: String,
    pub event_type: String,
    pub payload: serde_json::Value,
}

impl EventEnvelope {
    pub fn new(module: &str, event_type: &str, payload: serde_json::Value) -> Self {
        Self {
            timestamp: chrono::Utc::now(),
            module: module.to_string(),
            event_type: event_type.to_string(),
            payload,
        }
    }
}

// --- Redis Channel Constants ---

pub const CHANNEL_RECON_SIGNALS: &str = "mas:recon:signals";
pub const CHANNEL_MINT_DEPLOYED: &str = "mas:mint:deployed";
pub const CHANNEL_DETECT_RESULTS: &str = "mas:detect:results";
pub const CHANNEL_RISK_ALERTS: &str = "mas:risk:alerts";
pub const CHANNEL_ORACLE_RESULTS: &str = "mas:oracle:results";
pub const CHANNEL_TXENG_STATUS: &str = "mas:txeng:status";
pub const CHANNEL_ECONOMY_SETTLED: &str = "mas:economy:settled";

// --- Error Codes ---

pub mod error_codes {
    pub const REDIS_CONN: &str = "MAS_E1001";
    pub const REDIS_TIMEOUT: &str = "MAS_E1002";
    pub const REDIS_STREAM: &str = "MAS_E1003";
    pub const CLICKHOUSE_CONN: &str = "MAS_E2001";
    pub const CLICKHOUSE_INSERT: &str = "MAS_E2002";
    pub const CLICKHOUSE_QUERY: &str = "MAS_E2003";
    pub const RPC_TIMEOUT: &str = "MAS_E3001";
    pub const RPC_RATE_LIMIT: &str = "MAS_E3002";
    pub const RPC_INVALID: &str = "MAS_E3003";
    pub const TX_BUILD: &str = "MAS_E4001";
    pub const TX_SIGN: &str = "MAS_E4002";
    pub const TX_SUBMIT: &str = "MAS_E4003";
    pub const TX_CONFIRM: &str = "MAS_E4004";
    pub const LLM_TIMEOUT: &str = "MAS_E5001";
    pub const LLM_RATE: &str = "MAS_E5002";
    pub const LLM_PARSE: &str = "MAS_E5003";
    pub const LLM_BUDGET: &str = "MAS_E5004";
    pub const CB_YELLOW: &str = "MAS_E6001";
    pub const CB_ORANGE: &str = "MAS_E6002";
    pub const CB_RED: &str = "MAS_E6003";
    pub const CLONE_LIMIT: &str = "MAS_E7001";
    pub const BUDGET_EXCEEDED: &str = "MAS_E7002";
}
