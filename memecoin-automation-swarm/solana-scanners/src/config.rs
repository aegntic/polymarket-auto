use anyhow::{Context, Result};

pub struct Config {
    pub helius_api_key: String,
    pub poll_interval_secs: u64,
    pub known_wallets: Vec<String>,
}

impl Config {
    pub fn load() -> Result<Self> {
        dotenvy::from_path("../.env").ok();
        dotenvy::from_path("../../.env").ok();

        let helius_api_key = std::env::var("HELIUS_API_KEY")
            .context("HELIUS_API_KEY not set in .env")?;

        let poll_interval_secs = std::env::var("POLL_INTERVAL_SECS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(60);

        let known_wallets = vec![
            // PRECOGNITIVE wallets from Phase 0 historical runs
            "2e1w3Xo441Ytvwn54wCn8itAXwCKbiizc9ynGEv14Vis".to_string(),
            "8MaVa9kdt3NW4Q5HyNAm1X5LbR8PQRVDc1W8NMVK88D5".to_string(),
            // SOVEREIGN wallet
            "CyaE1VxvBrahnPWkqm5VsdCvyS2QmNht2UFrKJHga54o".to_string(),
        ];

        Ok(Self { helius_api_key, poll_interval_secs, known_wallets })
    }
}
