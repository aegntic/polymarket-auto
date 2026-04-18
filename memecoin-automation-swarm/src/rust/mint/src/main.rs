use anyhow::Result;
use mint::{MintConfig, MintService};
use shared::redis_client::RedisPool;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter("mint=info,shared=info")
        .init();

    let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into());
    let redis = RedisPool::new(&redis_url).await?;

    let config = MintConfig {
        chain: shared::Chain::Solana,
        network: shared::Network::Devnet,
        max_clone_per_day: 50,
    };

    let mut service = MintService::new(config, redis);
    tracing::info!("MINT service starting...");

    // Run subscriber loop in background
    tokio::spawn(async move {
        if let Err(e) = service.start().await {
            tracing::error!("MINT subscriber loop failed: {}", e);
        }
    });

    tokio::signal::ctrl_c().await?;
    tracing::info!("MINT shutting down");
    Ok(())
}
