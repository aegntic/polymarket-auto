-- CloneNet: Token observations and classification data
-- ClickHouse schema for the memecoin clone detection research platform

CREATE DATABASE IF NOT EXISTS clonet;

-- Raw token observations from RECON
CREATE TABLE IF NOT EXISTS clonet.token_observations
(
    id              UUID DEFAULT generateUUIDv4(),
    token_address   String,
    chain           LowCardinality(String),  -- solana, base, bnb
    name            String,
    symbol          String,
    description     String DEFAULT '',
    metadata_uri    String DEFAULT '',
    image_hash      String DEFAULT '',
    creator_address String DEFAULT '',
    deploy_tx       String DEFAULT '',
    first_seen_at   DateTime64(3, 'UTC'),
    observed_at     DateTime64(3, 'UTC') DEFAULT now64(3),
    block_slot      UInt64 DEFAULT 0,

    -- Source tracking
    source          LowCardinality(String),  -- geyser, helius_das, dexscreener, birdeye
    network         LowCardinality(String),  -- devnet, testnet, mainnet
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(first_seen_at)
ORDER BY (chain, token_address, first_seen_at)
TTL first_seen_at + INTERVAL 365 DAY;

-- Classification results from DETECT
CREATE TABLE IF NOT EXISTS clonet.classifications
(
    id              UUID DEFAULT generateUUIDv4(),
    token_address   String,
    chain           LowCardinality(String),
    classification  LowCardinality(String),  -- clone, original, unknown
    confidence      Float32,
    clone_probability Float32,
    original_token  Nullable(String),
    clone_type      Nullable(String),         -- exact_name, similar_name, similar_symbol, combined
    naming_strategy Nullable(String),         -- substitution, homophone, suffix, unicode, other

    -- Method scores
    rule_based_score Float32 DEFAULT 0,
    ml_score         Float32 DEFAULT 0,
    oracle_score     Float32 DEFAULT 0,

    -- Feature vector
    name_levenshtein       UInt16 DEFAULT 0,
    symbol_levenshtein     UInt16 DEFAULT 0,
    deployment_delay_sec   Float32 DEFAULT 0,
    holder_count_1min      UInt32 DEFAULT 0,
    holder_count_5min      UInt32 DEFAULT 0,
    unique_buyer_ratio     Float32 DEFAULT 0,
    top_10_holder_pct      Float32 DEFAULT 0,
    buy_volume_1min_sol    Float64 DEFAULT 0,
    creator_wallet_age_hours Float64 DEFAULT 0,
    metadata_similarity    Float32 DEFAULT 0,
    image_hash_similarity  Float32 DEFAULT 0,

    -- Tracking
    methods_used    Array(String),
    reasoning       String DEFAULT '',
    classified_at   DateTime64(3, 'UTC') DEFAULT now64(3),
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(classified_at)
ORDER BY (chain, token_address, classified_at);

-- Clone deployment log (MINT module)
CREATE TABLE IF NOT EXISTS clonet.clone_deployments
(
    id                  UUID DEFAULT generateUUIDv4(),
    clone_address       String,
    original_address    String,
    chain               LowCardinality(String),
    network             LowCardinality(String),
    naming_strategy     LowCardinality(String),
    deploy_method       LowCardinality(String),  -- pumpfun, spl_token, token2022
    deploy_tx           String,
    deployed_at         DateTime64(3, 'UTC') DEFAULT now64(3),
    research_controlled UInt8 DEFAULT 1,  -- 1 = deployed by us, 0 = observed in wild
)
ENGINE = MergeTree()
ORDER BY (chain, deployed_at);

-- Economy ledger entries
CREATE TABLE IF NOT EXISTS clonet.economy_ledger
(
    id          UUID DEFAULT generateUUIDv4(),
    from_module String,
    to_module   String,
    amount_micro_usd Int64,
    service     String,
    settled_at  DateTime64(3, 'UTC') DEFAULT now64(3),
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(settled_at)
ORDER BY (settled_at);

-- Module P&L snapshot
CREATE TABLE IF NOT EXISTS clonet.module_pnl
(
    module          String,
    balance_micro_usd Int64,
    total_earned    Int64,
    total_spent     Int64,
    snapshot_at     DateTime64(3, 'UTC') DEFAULT now64(3),
)
ENGINE = ReplacingMergeTree()
ORDER BY (module, snapshot_at);

-- LLM API usage tracking
CREATE TABLE IF NOT EXISTS clonet.llm_usage
(
    id          UUID DEFAULT generateUUIDv4(),
    provider    LowCardinality(String),  -- openai, anthropic, ollama
    model       String,
    prompt_tokens   UInt32,
    completion_tokens UInt32,
    cost_usd    Float64,
    purpose     LowCardinality(String),  -- classify, content_gen, narrative
    called_at   DateTime64(3, 'UTC') DEFAULT now64(3),
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(called_at)
ORDER BY (provider, called_at);

-- Circuit breaker events
CREATE TABLE IF NOT EXISTS clonet.circuit_breaker_events
(
    id          UUID DEFAULT generateUUIDv4(),
    level       LowCardinality(String),  -- yellow, orange, red
    trigger     String,
    action      String,
    details     String DEFAULT '',
    fired_at    DateTime64(3, 'UTC') DEFAULT now64(3),
)
ENGINE = MergeTree()
ORDER BY (fired_at);

-- Daily audit report materialized view source
CREATE TABLE IF NOT EXISTS clonet.daily_audit
(
    date                Date,
    clones_deployed     UInt32 DEFAULT 0,
    tokens_classified   UInt32 DEFAULT 0,
    clones_detected     UInt32 DEFAULT 0,
    llm_cost_usd        Float64 DEFAULT 0,
    circuit_breaker_hits UInt32 DEFAULT 0,
)
ENGINE = SummingMergeTree()
ORDER BY date;

-- Useful queries materialized as views
CREATE VIEW IF NOT EXISTS clonet.v_clone_rate AS
SELECT
    toStartOfHour(deployed_at) AS hour,
    chain,
    network,
    count() AS deployments
FROM clonet.clone_deployments
GROUP BY hour, chain, network;

CREATE VIEW IF NOT EXISTS clonet.v_classification_accuracy AS
SELECT
    classification,
    avg(confidence) AS avg_confidence,
    count() AS total
FROM clonet.classifications
GROUP BY classification;
