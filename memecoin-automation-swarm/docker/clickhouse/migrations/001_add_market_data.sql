-- Migration 001: Add market data columns to token_observations
-- Run against existing ClickHouse deployments that were created before these columns existed.
-- For fresh installs, docker/clickhouse/schema.sql already includes these columns.

ALTER TABLE clonet.token_observations
    ADD COLUMN IF NOT EXISTS volume_1h Float64 DEFAULT 0,
    ADD COLUMN IF NOT EXISTS initial_market_cap_usd Float64 DEFAULT 0,
    ADD COLUMN IF NOT EXISTS initial_liquidity_sol Float64 DEFAULT 0,
    ADD COLUMN IF NOT EXISTS holder_count_1h UInt32 DEFAULT 0,
    ADD COLUMN IF NOT EXISTS signal_score Float32 DEFAULT 0;
