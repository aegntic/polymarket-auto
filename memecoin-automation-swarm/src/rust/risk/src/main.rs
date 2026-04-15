use anyhow::Result;
use shared::redis_client::RedisPool;
use risk::{RiskConfig, RiskService};

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter("risk=info,shared=info")
        .init();

    let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into());
    let redis = RedisPool::new(&redis_url).await?;

    let config = RiskConfig::default();
    let mut service = RiskService::new(config, redis);
    service.start().await?;

    tokio::signal::ctrl_c().await?;
    tracing::info!("RISK shutting down");
    Ok(())
}
