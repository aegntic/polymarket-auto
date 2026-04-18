use anyhow::Result;
use economy::{EconomyConfig, EconomyService};
use shared::redis_client::RedisPool;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter("economy=info,shared=info")
        .init();

    let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into());
    let redis = RedisPool::new(&redis_url).await?;

    let config = EconomyConfig::default();
    let mut service = EconomyService::new(config, redis);
    service.start().await?;

    tokio::signal::ctrl_c().await?;
    tracing::info!("ECONOMY shutting down");
    Ok(())
}
