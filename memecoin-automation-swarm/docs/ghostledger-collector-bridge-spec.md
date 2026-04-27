# GhostLedger-v2 Collector Bridge Specification

**Status:** Draft
**Issue:** PAP-3
**Date:** 2026-04-27
**Owner:** Claude-Coder

## Overview

This document defines the contract between GhostLedger-v2 collector source adapters and the evidence pipeline. It specifies the minimal CLI/API interface, Redis event patterns, and validation requirements for collecting blockchain and off-chain intelligence.

## Architecture Constraints

### Language Boundary (CRITICAL)

- **Rust (Hot Path):** ALL evidence collection, validation, and envelope construction MUST be in Rust
- **TypeScript (Control Plane):** Handles ONLY collector monitoring, health checks, and configuration
- **Forbidden:** TypeScript in the collection pipeline, direct wallet data fabrication, synthetic evidence

### Evidence Invariants

1. **Source Traceability:** Every evidence payload MUST include `source` and `source_metadata` fields
2. **Validation Links:** `validation.confirmations` MUST reference actual blockchain data or API responses
3. **No Fabrication:** Missing fields MUST be `null`, never invented or interpolated
4. **Atomic Publishing:** Events MUST be published as complete `EventEnvelope` messages via Redis pub/sub

## Redis Event Contract

### Envelope Format

All events follow the standard MAS envelope:

```rust
pub struct EventEnvelope {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub module: String,        // "ghostledger"
    pub event_type: String,    // See Event Types below
    pub payload: serde_json::Value,
}
```

### Event Types and Channels

| Event Type | Redis Channel | Payload Type | Purpose |
|------------|---------------|--------------|---------|
| `token_observed` | `mas:ghostledger:token_observed` | `TokenObserved` | New token detected from any source |
| `wallet_trade_observed` | `mas:ghostledger:wallet_trade_observed` | `WalletTradeObserved` | Wallet swap/buy/sell event |
| `liquidity_event` | `mas:ghostledger:liquidity_event` | `LiquidityEvent` | Pool creation, add, remove, burn |
| `early_buyer_detected` | `mas:ghostledger:early_buyer_detected` | `EarlyBuyerDetected` | Derived: early N buyers of new token |
| `source_validation` | `mas:ghostledger:source_validation` | `SourceValidation` | Source health and data quality |
| `collector_status` | `mas:ghostledger:collector_status` | `CollectorStatus` | Collector heartbeat and metrics |

## Payload Schemas

### 1. TokenObserved

Emitted when a new token is detected from any source (DEX launch, API listing, on-chain creation).

```rust
pub struct TokenObserved {
    // Identity
    pub token_address: String,           // REQUIRED: On-chain address
    pub chain: Chain,                    // REQUIRED: Solana/Base/Bnb
    pub symbol: String,                  // REQUIRED: Token symbol
    pub name: String,                    // REQUIRED: Token name
    pub decimals: u8,                    // REQUIRED: Token decimals

    // Provenance
    pub creator_address: Option<String>,  // Deployer wallet (if available)
    pub creation_tx: Option<String>,      // Deployment transaction signature
    pub created_at: chrono::DateTime<chrono::Utc>,

    // Source
    pub source: Source,                  // DexscreenerApi, PumpfunWss, HeliusRpc, etc.
    pub source_metadata: SourceMetadata,  // API links, explorer URLs

    // Market Data (optional, never fabricate)
    pub initial_liquidity_usd: Option<f64>,
    pub initial_market_cap_usd: Option<f64>,

    // Validation
    pub validation: ValidationResult,     // is_valid, errors, confirmations
}
```

**Evidence Requirements:**
- `token_address` MUST be verified via RPC or explorer
- `creation_tx` MUST be a valid transaction signature if present
- `initial_liquidity_usd` MUST come from DEX API or pool calculation
- `validation.confirmations` MUST include block height or API response ID

### 2. WalletTradeObserved

Emitted for each individual wallet trade event detected on-chain or via API.

```rust
pub struct WalletTradeObserved {
    // Identity
    pub wallet_address: String,          // REQUIRED: Trader wallet
    pub token_address: String,           // REQUIRED: Token being traded
    pub chain: Chain,
    pub trade_type: TradeType,           // Buy | Sell

    // Amounts
    pub amount_tokens: String,           // REQUIRED: Token amount (as string for precision)
    pub amount_usd: Option<f64>,         // USD value if available
    pub price_per_token_usd: Option<f64>,

    // On-chain proof
    pub tx_signature: String,            // REQUIRED: Transaction signature
    pub slot: Option<u64>,               // Solana slot (if available)
    pub timestamp: chrono::DateTime<chrono::Utc>,

    // Context
    pub source: Source,
    pub source_metadata: SourceMetadata,
    pub pair_address: Option<String>,    // DEX pair address
    pub slippage_bps: Option<u32>,       // Calculated slippage if derivable

    // Validation
    pub validation: ValidationResult,
}
```

**Evidence Requirements:**
- `tx_signature` MUST be verifiable on-chain
- `amount_tokens` MUST be decoded from transaction logs
- `wallet_address` MUST be signer or authority in transaction
- `validation.confirmations` MUST include slot or block height

### 3. LiquidityEvent

Emitted for pool creation, liquidity provision, removal, or burns.

```rust
pub struct LiquidityEvent {
    // Identity
    pub pool_address: String,            // REQUIRED: Pool/DEX pair address
    pub token_address: String,           // REQUIRED: Token in the pair
    pub chain: Chain,
    pub event_type: LiquidityEventType,  // Add | Remove | Burn | Create

    // Amounts
    pub amount_token: Option<String>,    // Token amount added/removed
    pub amount_quote_usd: Option<f64>,   // USD value of quote side

    // On-chain proof
    pub tx_signature: Option<String>,    // Transaction if on-chain event
    pub timestamp: chrono::DateTime<chrono::Utc>,

    // Context
    pub source: Source,
    pub source_metadata: SourceMetadata,
    pub pool_type: Option<PoolType>,     // ConstantProduct | Concentrated | Stable

    // Validation
    pub validation: ValidationResult,
}
```

**Evidence Requirements:**
- `pool_address` MUST be valid DEX pair address
- `tx_signature` MUST be verifiable if present
- `amount_token` and `amount_quote_usd` MUST come from transaction logs or pool reserves

### 4. EarlyBuyerDetected

**DERIVED EVENT:** Computed from `WalletTradeObserved` events for tokens with `created_at` within a time window.

```rust
pub struct EarlyBuyerDetected {
    // Identity
    pub token_address: String,
    pub chain: Chain,
    pub wallet_address: String,
    pub buyer_rank: u64,                 // 1 = first buyer, 2 = second, etc.

    // Original trade proof
    pub buy_tx_signature: String,
    pub buy_timestamp: chrono::DateTime<chrono::Utc>,
    pub amount_tokens: String,
    pub amount_usd: Option<f64>,

    // Computation context
    pub source: Source,                  // Inherited from original trade
    pub source_metadata: SourceMetadata,
    pub token_age_seconds: Option<u64>,  // Time from token creation to buy

    // Validation
    pub validation: ValidationResult,
}
```

**Evidence Requirements:**
- MUST reference original `buy_tx_signature` from `WalletTradeObserved`
- `buyer_rank` MUST be computed from actual trade timestamps
- `token_age_seconds` requires `TokenObserved.created_at`
- **DO NOT** derive from incomplete or synthetic trade data

### 5. SourceValidation

Emitted when source adapter performs self-check or cross-validation.

```rust
pub struct SourceValidation {
    pub source: Source,
    pub validation_type: ValidationType,  // Token | Wallet | Trade | Liquidity
    pub is_valid: bool,
    pub confidence_score: Option<f64>,    // 0.0-1.0 if applicable
    pub errors: Option<Vec<String>>,
    pub warnings: Option<Vec<String>>,
    pub validated_at: chrono::DateTime<chrono::Utc>,
    pub raw_data_hash: Option<String>,     // For reproducibility
    pub source_metadata: serde_json::Value,
}
```

### 6. CollectorStatus

Emitted periodically (every 30-60s) for collector health monitoring.

```rust
pub struct CollectorStatus {
    pub collector_id: String,
    pub status: CollectorHealth,          // Healthy | Degraded | Error
    pub uptime_seconds: u64,
    pub events_collected_last_minute: u64,
    pub events_collected_total: u64,
    pub active_sources: Vec<Source>,
    pub failed_sources: Vec<Source>,
    pub throughput_events_per_sec: f64,
    pub latency_ms_p50: Option<u64>,
    pub latency_ms_p95: Option<u64>,
    pub latency_ms_p99: Option<u64>,
    pub last_error: Option<String>,
}
```

## Source Adapter Contract

### Trait Definition

All source adapters MUST implement the `SourceAdapter` trait:

```rust
#[async_trait]
pub trait SourceAdapter: Send + Sync {
    /// Unique identifier for this source adapter
    fn source(&self) -> Source;

    /// Check if the source is currently healthy and reachable
    async fn health_check(&self) -> Result<bool>;

    /// Start collecting events from this source
    /// Returns when the source stops emitting events or an error occurs
    async fn collect(&self, redis: &RedisPool) -> Result<()>;
}
```

### Required Behavior

1. **Health Checks:** Source MUST verify connectivity and API rate limits before emitting events
2. **Error Recovery:** Transient errors MUST trigger retry with exponential backoff
3. **Validation:** All emitted events MUST pass `validation.is_valid == true` checks
4. **Metadata:** All events MUST include `source_metadata` with relevant links (explorer, API, etc.)
5. **Rate Limiting:** Sources MUST implement rate limiting per AGENTS.md constraints

### Built-in Sources

| Source | Type | Description |
|--------|------|-------------|
| `DexscreenerApi` | HTTP | Token listings, pairs, price data |
| `PumpfunWss` | WebSocket | Real-time token launches on pump.fun |
| `JupiterAggregator` | HTTP/API | Swap routes and aggregator data |
| `RaydiumApi` | HTTP | Raydium DEX pools and trades |
| `BirdeyeApi` | HTTP | Token analytics and wallet data |
| `HeliusRpc` | WebSocket/RPC | Enhanced Solana RPC with webhooks |
| `SolanaRpc` | WebSocket/RPC | Native Solana RPC (geyser, DAS) |
| `TritonRpc` | WebSocket/RPC | Alternative Solana RPC provider |

## CLI Contract

### Collector Binary

```bash
# Start collector with all sources
ghostledger-collector --config ./collector-config.toml

# Start specific source adapter
ghostledger-collector --source dexscreener --redis-url redis://localhost:6379

# Health check mode (exit 0 if healthy, 1 if degraded)
ghostledger-collector --health-check --source helius

# Validation mode (verify evidence chain for given token)
ghostledger-collector --validate-token --address <TOKEN_ADDRESS> --chain solana
```

### Configuration (TOML)

```toml
[redis]
url = "redis://localhost:6379"

[collector]
id = "ghostledger-primary"
heartbeat_interval_secs = 30

[[sources]]
name = "dexscreener"
enabled = true
api_key = "${DEXSCREENER_API_KEY}"
rate_limit_rps = 10

[[sources]]
name = "pumpfun"
enabled = true
wss_url = "wss://frontend-api.pump.fun/ws"
rate_limit_rps = 5

[validation]
require_confirmations = true
min_confidence_score = 0.7
reject_synthetic_evidence = true

[monitoring]
enable_prometheus = true
prometheus_port = 9090
log_level = "info"
```

## Evidence Validation Rules

### Source Validation

1. **On-chain Data:** All blockchain-derived data MUST reference `tx_signature` or `slot`
2. **API Data:** All API-derived data MUST include `api_response_id` or timestamp
3. **Explorer Links:** `source_metadata.explorer_link` MUST be a valid Solscan/Explorer URL
4. **Decimals:** Token amounts MUST use decimals from on-chain metadata, never assume

### Rejection Criteria

Events MUST be rejected (emitted with `validation.is_valid = false`) when:

- Missing required fields (`token_address`, `wallet_address`, `tx_signature`)
- Invalid address format (not 32/44 bytes for Solana)
- `tx_signature` not found on-chain or in mempool
- Duplicate event with same `tx_signature` already processed
- Amounts inconsistent with transaction logs
- Source API returns error or rate limit exceeded
- **Synthetic evidence detected** (no on-chain proof, fabricated wallet, interpolated PnL)

## Implementation Notes

### Do's

✅ Keep collection logic in Rust
✅ Use `anyhow` for error handling
✅ Use `tracing` for instrumentation
✅ Implement exponential backoff for retries
✅ Include `source_metadata` with links
✅ Validate `tx_signature` on-chain before emitting

### Don'ts

❌ Use TypeScript in collection hot path
❌ Fabricate wallet addresses or trade data
❌ Interpolate missing fields (use `null` instead)
❌ Emit events without `validation` field
❌ Skip rate limiting
❌ Assume decimals (always fetch from chain)

## Testing

Evidence payloads MUST pass these tests:

```bash
# Type validation
cargo test --lib ghostledger::tests::test_envelope_construction

# Redis integration
cargo test --lib ghostledger::tests::test_publish_and_subscribe

# Source adapter health
cargo test --lib ghostledger::collectors::tests::test_source_health_check

# Validation rules
cargo test --lib ghostledger::tests::test_validation_rejection_criteria
```

## References

- PAP-2: Rust evidence schema/types in memecoin-automation-swarm
- AGENTS.md: Redis envelope format and module communication rules
- GHOSTLEDGER-PAPERCLIP-WIRING.md: System roles and evidence invariants
