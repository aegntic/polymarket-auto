use anyhow::Result;
use shared::redis_client::RedisPool;
use recon::{ReconConfig, ReconService};

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter("recon=info,shared=info")
        .init();

    let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into());
    let rpc_url = std::env::var("SOLANA_RPC_URL").unwrap_or_else(|_| "http://localhost:8899".into());

    let redis = RedisPool::new(&redis_url).await?;
    let config = ReconConfig {
        rpc_url,
        chain: shared::Chain::Solana,
        network: shared::Network::Devnet,
        signal_weights: Default::default(),
    };

    let mut service = ReconService::new(config, redis);
    service.start().await?;

    tokio::signal::ctrl_c().await?;
    tracing::info!("RECON shutting down");
    Ok(())
}
