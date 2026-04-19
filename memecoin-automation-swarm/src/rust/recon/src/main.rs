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
    let rpc_url =
        std::env::var("SOLANA_RPC_URL").unwrap_or_else(|_| "http://localhost:8899".into());

    // M7: Publish heartbeat every 30s
    let mut hb_redis = RedisPool::new(&redis_url).await?;
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
            let now = chrono::Utc::now().to_rfc3339();
            if let Err(e) = hb_redis.set("mas:heartbeat:recon", &now, Some(60)).await {
                tracing::warn!("Failed to publish heartbeat: {}", e);
            }
        }
    });

    let _redis = RedisPool::new(&redis_url).await?;
    let config = ReconConfig {
        redis_url: redis_url.clone(),
        rpc_ws_url,
        rpc_url,
    };

    let service = ReconService::new(config);
    service.start().await?;

    tokio::signal::ctrl_c().await?;
    tracing::info!("RECON shutting down");
    Ok(())
}
