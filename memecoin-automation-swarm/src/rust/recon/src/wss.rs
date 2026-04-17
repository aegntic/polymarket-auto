use futures_util::stream::StreamExt;
use redis::AsyncCommands;
use serde_json::json;
use shared::{Chain, TokenObservation};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use tracing::{debug, error, info};
use url::Url;

const PUMP_FUN_PROGRAM: &str = "6EF8rrecthR5Dkzon8Nwu78hRvfX9PNnN62P5V3z5"; // Pump.fun factory

/// Establishes a WebSocket connection to a Solana RPC and subscribes to logs for the Pump.fun program.
/// This runs at the absolute bare metal T+0ms.
pub async fn start_sniper_listener(rpc_ws_url: &str, redis_url: &str) -> anyhow::Result<()> {
    let url = Url::parse(rpc_ws_url)?;

    info!("Connecting to WSS: {}", rpc_ws_url);
    let (ws_stream, _) = connect_async(url.to_string())
        .await
        .map_err(|e| anyhow::anyhow!("WSS connection failed: {}", e))?;

    let (mut write, mut read) = ws_stream.split();

    // Subscribe to Pump.fun Program Logs
    let subscribe_msg = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "logsSubscribe",
        "params": [
            {"mentions": [PUMP_FUN_PROGRAM]},
            {"commitment": "processed"} // Fastest commitment level for true sniping
        ]
    });

    use futures_util::SinkExt;
    write
        .send(Message::Text(subscribe_msg.to_string().into()))
        .await?;
    info!("Subscribed to Pump.fun logs. Waiting for new mints...");

    let client = redis::Client::open(redis_url)?;
    let mut redis_conn = client.get_multiplexed_async_connection().await?;

    while let Some(msg) = read.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                let text_str = text.to_string();
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text_str) {
                    if let Some(params) = parsed.get("params") {
                        if let Some(result) = params.get("result") {
                            if let Some(value) = result.get("value") {
                                if let Some(logs) = value.get("logs") {
                                    // Extremely fast string check before deep parsing
                                    let logs_str = logs.to_string();
                                    if logs_str.contains("InitializeMint")
                                        || logs_str.contains("Create")
                                    {
                                        // For simulation/scaffolding purposes, we generate a mock TokenObservation
                                        // In production, we decode the transaction signature via RPC to get the exact mint and creator.
                                        let sig = value
                                            .get("signature")
                                            .and_then(|s| s.as_str())
                                            .unwrap_or("unknown_sig");

                                        debug!(
                                            "Detected Pump.fun Creation event! Signature: {}",
                                            sig
                                        );

                                        let now = SystemTime::now()
                                            .duration_since(UNIX_EPOCH)
                                            .unwrap()
                                            .as_millis()
                                            as u64;

                                        let now_dt = chrono::Utc::now();
                                        let obs = TokenObservation {
                                            token_address: format!("mint_{}", &sig[0..8]), // placeholder until RPC decode
                                            chain: Chain::Solana,
                                            name: "Unknown_WSS".to_string(),
                                            symbol: "UNK".to_string(),
                                            decimals: 6,
                                            supply: Some("1000000000".to_string()),
                                            creator_address: Some(
                                                "unknown_creator_wss".to_string(),
                                            ),
                                            creation_tx: Some(sig.to_string()),
                                            created_at: now_dt,
                                            metadata_uri: Some("".to_string()),
                                            logo_uri: Some("".to_string()),
                                            initial_liquidity_sol: Some(85.0), // default pumpfun bond curve
                                            initial_market_cap_usd: Some(30000.0),
                                            holder_count_1h: Some(1),
                                            volume_1h: Some(0.0),
                                            signal_score: Some(50), // base score until TS modifies it
                                        };

                                        // Fire the signal to Redis instantly for RISK/DETECT modules
                                        let payload = json!({
                                            "timestamp": now,
                                            "module": "recon_wss",
                                            "event_type": "signal_detected",
                                            "payload": obs,
                                        });

                                        let _: () = redis_conn
                                            .publish("recon:signals", payload.to_string())
                                            .await?;
                                        info!("Fast-pathed new mint signal to Redis! Sig: {}", sig);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Ok(_) => {} // Handle ping/pong etc
            Err(e) => {
                error!("WSS Error: {}", e);
                break;
            }
        }
    }

    Ok(())
}
