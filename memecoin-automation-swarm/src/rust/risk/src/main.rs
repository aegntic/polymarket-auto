use anyhow::Result;
use risk::{RiskConfig, RiskService};
use shared::redis_client::RedisPool;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter("risk=info,shared=info")
        .init();

    let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into());
    let redis = RedisPool::new(&redis_url).await?;

    // M7: Publish heartbeat every 30s
    let mut hb_redis = RedisPool::new(&redis_url).await?;
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
            let now = chrono::Utc::now().to_rfc3339();
            if let Err(e) = hb_redis.set("mas:heartbeat:risk", &now, Some(60)).await {
                tracing::warn!("Failed to publish heartbeat: {}", e);
            }
        }
    });

    let config = RiskConfig::default();
    let mut service = RiskService::new(config, redis);
    service.start().await?;

    tokio::signal::ctrl_c().await?;
    tracing::info!("RISK shutting down");
    Ok(())
}
