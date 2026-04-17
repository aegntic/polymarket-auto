pub mod ingest;
pub mod shared;
pub mod wss; // Add our new ultra-fast hot path sniper module

use tracing::{error, info};

pub struct ReconConfig {
    pub redis_url: String,
    pub rpc_ws_url: String, // WebSocket URL for Solana Sniper
    pub rpc_url: String,    // HTTP URL for Solana RPC to decode tx
}

pub struct ReconService {
    config: ReconConfig,
}

impl ReconService {
    pub fn new(config: ReconConfig) -> Self {
        Self { config }
    }

    pub async fn start(&self) -> anyhow::Result<()> {
        info!("Starting RECON Service...");

        // Launch the WSS Sniper thread (Hot Path)
        let rpc_ws_url = self.config.rpc_ws_url.clone();
        let redis_url = self.config.redis_url.clone();
        let rpc_url = self.config.rpc_url.clone();

        tokio::spawn(async move {
            if let Err(e) = wss::start_sniper_listener(&rpc_ws_url, &redis_url, &rpc_url).await {
                error!("WSS Sniper thread failed: {}", e);
            }
        });

        // Loop forever
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
        }
    }
}
