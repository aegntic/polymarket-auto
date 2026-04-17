use anyhow::Result;
use recon::{ReconConfig, ReconService};
use shared::redis_client::RedisPool;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter("recon=info,shared=info")
        .init();

    let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into());
    let rpc_ws_url =
        std::env::var("SOLANA_RPC_WS_URL").unwrap_or_else(|_| "ws://localhost:8900".into());

    let _redis = RedisPool::new(&redis_url).await?; // keep if needed or ignore
    let config = ReconConfig {
        redis_url: redis_url.clone(),
        rpc_ws_url,
    };

    let service = ReconService::new(config);
    service.start().await?;

    tokio::signal::ctrl_c().await?;
    tracing::info!("RECON shutting down");
    Ok(())
}
