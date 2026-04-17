DROP TABLE IF EXISTS clonet.token_observations;

CREATE TABLE clonet.token_observations (
    token_address String,
    chain String,
    name String,
    symbol String,
    decimals UInt8,
    supply String,
    creator_address String,
    deploy_tx String,
    created_at String,
    first_seen_at String,
    source String
) ENGINE = MergeTree()
ORDER BY (first_seen_at, token_address);

DROP TABLE IF EXISTS clonet.classifications;

CREATE TABLE clonet.classifications (
    token_address String,
    chain String,
    classification String,
    confidence Float64,
    original_token String,
    reasoning String,
    classified_at String,
    model_used String,
    cost_usd Float64
) ENGINE = MergeTree()
ORDER BY (classified_at, token_address);
