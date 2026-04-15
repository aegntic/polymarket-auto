# Memecoin Clone Detection Research Platform

Blue-team research platform for memecoin clone detection. Deploys controlled test clones across devnet, testnet, and mainnet, observes detection signatures, trains ML classifiers, and publishes the CloneNet labeled dataset.

## Quick Start

```bash
# 1. Install prerequisites (Rust, Bun, Docker)
cp .env.example .env
# Edit .env with your API keys

# 2. Start infrastructure
docker compose -f docker/docker-compose.yml up -d

# 3. Setup database schema
docker exec -i memecoin-clickhouse clickhouse-client --queries-file /docker-entrypoint-initdb.d/schema.sql

# 4. Build and run
just dev
```

## Verify It Works

```bash
# Health check
curl http://localhost:8080/health

# Classify a token
curl -X POST http://localhost:8080/classify \
  -H "Content-Type: application/json" \
  -d '{"token_address": "So11111111111111111111111111111111111111112", "chain": "solana"}'
```

## API

See [openapi.yaml](./openapi.yaml) for full specification.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health + component status |
| `/classify` | POST | Classify a token (clone/original/unknown) |
| `/dataset/export` | GET | Export CloneNet dataset (Parquet or JSONL) |

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Rust | 1.85+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Bun | 1.1+ | `curl -fsSL https://bun.sh/install \| bash` |
| Docker | 24+ | https://docs.docker.com/get-docker/ |
| just | 1.16+ | `cargo install just` |

## Project Structure

```
src/
  rust/           # Hot path: signal detection, tx construction
  ts/             # Control plane: orchestration, API, analysis
docker/           # Docker Compose + service configs
configs/          # Chain-specific configuration
scripts/          # Setup and deployment scripts
```

## Modules

| Module | Language | Purpose |
|--------|----------|---------|
| RECON | Rust | Monitor token feeds across chains |
| MINT | Rust | Deploy controlled test clones |
| DETECT | Rust + TS | Signature extraction + ML classifier |
| RISK | Rust | Circuit breakers, safety controls |
| ORACLE | TS | LLM-based zero-shot classification |
| TXENG | Rust | Transaction engineering (Jito bundles) |
| CHAIN | TS | Multi-chain support (Base, BNB) |
| VIRAL | TS | Social media automation for bait tokens |
| API | TS | REST API (Hono) |
| DATASET | TS | CloneNet schema + HuggingFace export |

## Commands

```bash
just dev          # Start development environment
just test         # Run all tests
just lint         # Lint everything
just setup        # First-time setup
just clean        # Clean build artifacts
```

## Safety

This platform is for research only. Hard limits enforced in code:
- Max 50 clone deployments/day across all networks
- Max $10/day LLM API budget
- Circuit breakers at 30/hr (yellow), 40/hr (orange), unauthorized op (red = full halt)
- Mainnet deployments are "bait tokens" for detection validation only

## License

Custom Research License. See [LICENSE](./LICENSE). Non-commercial use only. Contact for commercial licensing.
