use anyhow::Result;
use txeng::TxEngService;
use shared::redis_client::RedisPool;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter("txeng=info,shared=info")
        .init();

    let redis_url =
        std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into());
    let redis = RedisPool::new(&redis_url).await?;

    let mut service = TxEngService::new(redis);
    tracing::info!("TXENG service starting...");

    tokio::spawn(async move {
        if let Err(e) = service.start().await {
            tracing::error!("TXENG subscriber loop failed: {}", e);
        }
    });

    tokio::signal::ctrl_c().await?;
    tracing::info!("TXENG shutting down");
    Ok(())
}
