CREATE DATABASE IF NOT EXISTS clonet;

CREATE TABLE IF NOT EXISTS clonet.token_observations (
    address String,
    symbol String,
    name String,
    chain String,
    dex String,
    liquidity_usd Float64,
    volume_24h Float64,
    market_cap Float64,
    holders UInt32,
    creation_time UInt64,
    observed_at UInt64
) ENGINE = MergeTree()
ORDER BY (observed_at, address);

CREATE TABLE IF NOT EXISTS clonet.signals (
    timestamp UInt64,
    module String,
    event_type String,
    payload String
) ENGINE = MergeTree()
ORDER BY timestamp;
