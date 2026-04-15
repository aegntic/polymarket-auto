# AGENTS.md — Memecoin Automation Swarm

## Project Overview

Blue-team research platform for memecoin clone detection. Deploys controlled test clones across
devnet, testnet, and mainnet, observes detection signatures, trains ML classifiers, and publishes
the CloneNet labeled dataset. Mainnet deployments are live "bait" tokens — indistinguishable from
real clone tokens — used to validate that detection systems catch them. Includes a VIRAL module
for real-world social media propagation research.

## Repository Layout (Planned)

```
memecoin-automation-swarm/
  src/
    rust/           # Hot path: signal detection, tx construction, bundle submission
    ts/             # Control plane: orchestration, monitoring, data analysis, API, viral
  docker/           # Docker Compose + service configs (Redis, ClickHouse, Grafana)
  configs/          # devnet.json, testnet.json, mainnet.json
  scripts/          # setup.sh, deploy-clone.sh, export-dataset.sh
  tests/
    rust/           # Rust unit + integration tests
    ts/             # TypeScript tests
    e2e/            # End-to-end pipeline tests
  Cargo.toml        # Rust workspace root
  package.json      # TypeScript/Bun root
  tsconfig.json
  Dockerfile
```

## Build & Run Commands

### Rust (Hot Path)

```bash
cargo build                    # Build all Rust crates
cargo build --release          # Optimized build for hot-path components
cargo test                     # Run all Rust tests
cargo test -p recon            # Run tests for a specific crate
cargo test test_signal_score   # Run a single test by name
cargo test -- --nocapture      # Run tests with stdout output
cargo clippy -- -D warnings    # Lint (treat warnings as errors)
cargo fmt -- --check           # Check formatting
```

### TypeScript (Control Plane)

```bash
bun install                    # Install dependencies
bun run dev                    # Start dev mode (control plane + API)
bun test                       # Run all TypeScript tests
bun test tests/detect/         # Run tests in a specific directory
bun test -t "classify token"   # Run a single test by name pattern
bun run lint                   # Lint (eslint)
bun run typecheck              # Type-check (tsc --noEmit)
```

### Docker (Full Stack)

```bash
docker compose up -d           # Start all services (Redis, ClickHouse, Grafana)
docker compose down            # Stop all services
docker compose logs -f recon   # Tail logs for a specific service
```

### Database

```bash
# ClickHouse schema migration (after docker compose up)
clickhouse-client --queries-file docker/clickhouse/schema.sql
```

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Hot path | Rust | Signal detection, tx construction, bundle submission |
| Control plane | TypeScript + Bun | Orchestration, monitoring, API, data analysis |
| Social automation | TypeScript + Bun (VIRAL) | Social posting, narrative seeding for real-world propagation research |
| State | Redis + Redis Streams | Pub/sub, durability, atomic ledger operations |
| Analytics | ClickHouse | ML training data, backtesting, signal scoring |
| Job queue | BullMQ | Priority, retry, rate limiting |
| Solana SDK | solana-sdk (Rust) + yellowstone-grpc | Geyser streaming, native performance |
| EVM | Viem | Type-safe, lightweight |
| ML | XGBoost | Feature-based clone classification |
| LLM | GPT-4o / Claude | Zero-shot classification via ORACLE module |
| Monitoring | Grafana + Prometheus + Loki | Dashboards, alerting, log aggregation |

## Code Style — Rust

- **Edition:** Rust 2021
- **Formatting:** `cargo fmt` is canonical. No configuration overrides.
- **Linting:** `cargo clippy -- -D warnings` must pass with zero warnings.
- **Error handling:** Use `anyhow::Result` for application code, `thiserror` for library crate
  error types. Never unwrap in production code; use `?` propagation or explicit match.
- **Async:** Tokio runtime. Use `tokio::spawn` for concurrent tasks within the hot path.
- **Types:** Strongly typed domain models. No `String` where an enum or newtype communicates
  intent better (e.g., `TokenAddress`, `SignalScore`, `ChainId`).
- **Naming:** `snake_case` for functions/variables, `PascalCase` for types/structs/enums.
  Module names are `snake_case`.
- **Redis integration:** Use `redis` crate with connection pooling. All state mutations use
  MULTI/EXEC for atomicity. Never perform non-atomic read-modify-write on shared state.
- **Logging:** `tracing` crate with structured fields. Use `tracing::info!`, `tracing::warn!`,
  etc. Never use `println!` in library or hot-path code.
- **Tests:** Unit tests in `#[cfg(test)] mod tests` within each file. Integration tests in
  `tests/` directory. Mock external services (RPC, Redis) — never hit real endpoints in CI.

## Code Style — TypeScript

- **Runtime:** Bun (not Node.js). Use Bun APIs where available (`Bun.file`, `Bun.serve`).
- **Package manager:** Bun (detected by `bun.lock`). Never mix with npm or yarn.
- **Formatting:** Prettier with defaults. Run `bun run fmt` or `bunx prettier --write .`.
- **Linting:** ESLint with strict rules. Run `bun run lint`. Fix before committing.
- **Type checking:** `tsc --noEmit` must pass. Enable `strict: true` in tsconfig.json.
- **Imports:** Use `import type` for type-only imports. Group imports: (1) node/bun builtins,
  (2) external packages, (3) internal modules — separated by blank lines.
- **Error handling:** Use typed error classes extending `BaseError`. Never catch and swallow
  errors silently. Log errors with context before re-throwing or handling.
- **Naming:** `camelCase` for variables/functions, `PascalCase` for classes/interfaces/types.
  Constants in `SCREAMING_SNAKE_CASE`. File names in `kebab-case`.
- **Async:** Top-level await is fine in Bun. Use `Promise.all` for concurrent operations.
  Prefer `async/await` over raw `.then()` chains.
- **Tests:** Use `bun:test` (built-in). Describe/it pattern. One test file per source file.
  Mock external services — never hit real RPC endpoints, Redis, or ClickHouse in CI.

## Architecture Rules

### Hot Path vs Control Plane Boundary

The hot path (Rust) handles: signal detection, decision-making, transaction construction,
bundle submission, economy settlement. TypeScript handles ONLY: monitoring, configuration,
social media, data analysis, API integrations. **No TypeScript in the request path from
signal detection to transaction submission.** The two layers communicate exclusively through
Redis pub/sub channels.

### Module Communication

Agents communicate through Redis channels: `recon:signals`, `mint:deployed`, `detect:classifications`,
`detect:alerts`, `oracle:predictions`, `risk:alerts`, `risk:settlement`, `txeng:submitted`,
`viral:posts`, `viral:narratives`.
All events use a consistent JSON envelope: `{ timestamp, module, event_type, payload }`.

### VIRAL Module (Social Media Automation)

The VIRAL module automates social media posting, narrative seeding, and cross-platform promotion
to validate that clone detection systems work against realistic social propagation patterns.
Bait tokens on mainnet must appear identical to genuine clone tokens — no labeling, watermarks,
or signals that would tip off detection systems.

Scope:
- Automated posting to X/Twitter, Telegram, Discord for bait clones
- Narrative seeding and content generation via LLM templates
- Cross-platform coordination (post scheduling, engagement tracking)
- Every action logged with timestamps for post-campaign analysis

Constraints:
- Never targets or impersonates specific real projects or communities
- No anti-detect browser infrastructure
- Budget falls under the $10/day LLM API cap for content generation

### Safety Constraints (RISK Module)

These are hard-coded, non-negotiable limits:
- Max 50 clone deployments per day (across all networks)
- Max $10/day LLM API budget
- All clones tagged with research provenance metadata (internal DB only — never on-chain)
- Circuit breakers: Yellow (>30/hr), Orange (>40/hr or >30% error), Red (unauthorized operation = full halt)
- Mainnet bait tokens must be indistinguishable from real clone tokens in on-chain metadata

### Internal Economy

Redis-backed double-entry ledger. All inter-agent service payments settle atomically via
MULTI/EXEC. Denominated in micro-USD. Each agent has its own account, P&L tracked in
ClickHouse. Capital reallocation every 15 min based on rolling 6-hour RAROC.

## Commit Conventions

- Conventional commits: `feat(recon): add Geyser streaming pipeline`
- Scope matches module name: recon, mint, detect, oracle, risk, txeng, chain, economy, viral
- Imperative mood, lowercase subject, no trailing period
- No `Co-Authored-By` lines

## PR Checklist

Before merging, verify:
1. `cargo clippy -- -D warnings` passes (Rust)
2. `cargo fmt -- --check` passes (Rust)
3. `bun run lint` passes (TypeScript)
4. `bun run typecheck` passes (TypeScript)
5. `cargo test` passes
6. `bun test` passes
7. No secrets or private keys in code or config
8. All new Redis operations use atomic primitives (MULTI/EXEC or Lua scripts)
