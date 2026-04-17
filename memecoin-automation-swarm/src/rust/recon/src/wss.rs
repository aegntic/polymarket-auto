use futures_util::stream::StreamExt;
use redis::AsyncCommands;
use reqwest;
use serde_json::{json, Value};
use shared::{Chain, TokenObservation};
use std::collections::HashSet;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use tracing::{debug, error, info, warn};
use url::Url;

const PUMP_FUN_PROGRAM: &str = "6EF8rrecthR5Dkzon8Nwu78hRvfX9PNnN62P5V3z5"; // Pump.fun factory

/// Syncs the list of alpha wallets from Redis.
/// In a real prod environment, this would run on a tokio::spawn interval or listen to a pub/sub channel.
async fn fetch_alpha_wallets(
    redis_conn: &mut redis::aio::MultiplexedConnection,
) -> HashSet<String> {
    let alphas: Result<Vec<String>, redis::RedisError> =
        redis_conn.zrange("mas:alpha_wallets", 0, -1).await;
    match alphas {
        Ok(wallets) => {
            if !wallets.is_empty() {
                debug!("Loaded {} alpha wallets from Redis", wallets.len());
            }
            wallets.into_iter().collect()
        }
        Err(_) => HashSet::new(),
    }
}

/// Establishes a WebSocket connection to a Solana RPC and subscribes to logs for the Pump.fun program.
/// This runs at the absolute bare metal T+0ms.
pub async fn start_sniper_listener(
    rpc_ws_url: &str,
    redis_url: &str,
    rpc_http_url: &str,
) -> anyhow::Result<()> {
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

    // Load initial alpha wallets
    let mut alpha_wallets = fetch_alpha_wallets(&mut redis_conn).await;
    let mut last_sync = SystemTime::now();

    while let Some(msg) = read.next().await {
        // Sync alpha wallets every 60 seconds
        if let Ok(elapsed) = last_sync.elapsed() {
            if elapsed.as_secs() > 60 {
                alpha_wallets = fetch_alpha_wallets(&mut redis_conn).await;
                last_sync = SystemTime::now();
            }
        }

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
                                        let sig = value
                                            .get("signature")
                                            .and_then(|s| s.as_str())
                                            .unwrap_or("unknown_sig");

                                        // Try to decode transaction via RPC to get actual mint and creator
                                        let mut actual_mint = format!("mint_{}", &sig[0..8]);
                                        let mut actual_creator = "unknown_creator_wss".to_string();
                                        let mut token_name = "Unknown_WSS".to_string();
                                        let mut token_symbol = "UNK".to_string();

                                        let req_client = reqwest::Client::new();
                                        let req_body = json!({
                                            "jsonrpc": "2.0",
                                            "id": 1,
                                            "method": "getTransaction",
                                            "params": [
                                                sig,
                                                {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}
                                            ]
                                        });

                                        match req_client
                                            .post(rpc_http_url)
                                            .json(&req_body)
                                            .send()
                                            .await
                                        {
                                            Ok(resp) => {
                                                if let Ok(tx_json) = resp.json::<Value>().await {
                                                    if let Some(meta) = tx_json
                                                        .get("result")
                                                        .and_then(|r| r.get("meta"))
                                                    {
                                                        // Extract mint address and creator from postTokenBalances
                                                        if let Some(post_tokens) = meta
                                                            .get("postTokenBalances")
                                                            .and_then(|pt| pt.as_array())
                                                        {
                                                            if !post_tokens.is_empty() {
                                                                if let Some(mint) = post_tokens[0]
                                                                    .get("mint")
                                                                    .and_then(|m| m.as_str())
                                                                {
                                                                    actual_mint = mint.to_string();
                                                                }
                                                                if let Some(owner) = post_tokens[0]
                                                                    .get("owner")
                                                                    .and_then(|o| o.as_str())
                                                                {
                                                                    actual_creator =
                                                                        owner.to_string();
                                                                }
                                                            }
                                                        }

                                                        // Extract token name/symbol from inner instructions.
                                                        // postTokenBalances[].uiTokenAmount only has
                                                        // amount/decimals, NOT metadata. Name and symbol
                                                        // come from Metaplex CreateMetadata instructions
                                                        // parsed in the innerInstructions array.
                                                        if let Some(inner) = meta
                                                            .get("innerInstructions")
                                                            .and_then(|i| i.as_array())
                                                        {
                                                            for group in inner {
                                                                if let Some(instructions) =
                                                                    group.get("instructions")
                                                                        .and_then(|i| i.as_array())
                                                                {
                                                                    for ix in instructions {
                                                                        if let Some(args) = ix
                                                                            .get("parsed")
                                                                            .and_then(|p| {
                                                                                p.get("args")
                                                                            })
                                                                        {
                                                                            if let Some(n) = args
                                                                                .get("name")
                                                                                .and_then(|n| {
                                                                                    n.as_str()
                                                                                })
                                                                            {
                                                                                if !n.is_empty() {
                                                                                    token_name =
                                                                                        n.to_string();
                                                                                }
                                                                            }
                                                                            if let Some(s) = args
                                                                                .get("symbol")
                                                                                .and_then(|s| {
                                                                                    s.as_str()
                                                                                })
                                                                            {
                                                                                if !s.is_empty() {
                                                                                    token_symbol =
                                                                                        s.to_string();
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }

                                                        // Fallback: parse name/symbol from log messages.
                                                        // Pump.fun emits metadata in program logs.
                                                        if token_name == "Unknown_WSS" {
                                                            if let Some(log_msgs) = meta
                                                                .get("logMessages")
                                                                .and_then(|l| l.as_array())
                                                            {
                                                                for log in log_msgs {
                                                                    if let Some(log_str) =
                                                                        log.as_str()
                                                                    {
                                                                        if log_str.contains("Create")
                                                                        {
                                                                            if let Some(data) =
                                                                                log_str
                                                                                    .split("Create ")
                                                                                    .nth(1)
                                                                            {
                                                                                let parts: Vec<&str> =
                                                                                    data
                                                                                        .split(',')
                                                                                        .collect();
                                                                                if parts.len() >= 2 {
                                                                                    let n = parts[0]
                                                                                        .trim()
                                                                                        .trim_matches('"');
                                                                                    let s = parts[1]
                                                                                        .trim()
                                                                                        .trim_matches('"');
                                                                                    if !n.is_empty() {
                                                                                        token_name = n.to_string();
                                                                                    }
                                                                                    if !s.is_empty() {
                                                                                        token_symbol = s.to_string();
                                                                                    }
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                            Err(e) => {
                                                error!("Failed to fetch tx from RPC: {}", e);
                                            }
                                        }

                                        // SHADOW GRAPH INTERCEPT:
                                        // Does the creator match a known alpha burner wallet?
                                        let is_insider = alpha_wallets.contains(&actual_creator);

                                        if is_insider {
                                            warn!("🔥 VAMPIRE SHADOW INTERCEPT! Known alpha wallet {} is deploying {}", actual_creator, actual_mint);
                                        } else {
                                            debug!(
                                                "Detected Pump.fun Creation event! Signature: {}",
                                                sig
                                            );
                                        }

                                        let now = SystemTime::now()
                                            .duration_since(UNIX_EPOCH)
                                            .unwrap()
                                            .as_millis()
                                            as u64;

                                        let now_dt = chrono::Utc::now();
                                        let obs = TokenObservation {
                                            token_address: actual_mint,
                                            chain: Chain::Solana,
                                            name: token_name,
                                            symbol: token_symbol,
                                            decimals: 6,
                                            supply: Some("1000000000".to_string()), // standard pumpfun initial supply
                                            creator_address: Some(actual_creator),
                                            creation_tx: Some(sig.to_string()),
                                            created_at: now_dt,
                                            metadata_uri: Some("".to_string()),
                                            logo_uri: Some("".to_string()),
                                            initial_liquidity_sol: Some(85.0), // default pumpfun bond curve
                                            initial_market_cap_usd: Some(30000.0),
                                            holder_count_1h: Some(1),
                                            volume_1h: Some(0.0),
                                            signal_score: Some(if is_insider { 99 } else { 50 }), // Massive boost for insiders
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
