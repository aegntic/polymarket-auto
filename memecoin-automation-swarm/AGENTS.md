# AGENTS.md: Memecoin Automation Swarm - Agent Directives

Welcome, Agent. This file outlines crucial rules, boundaries, and commands for operating within this repository. **Failure to adhere to these constraints is a critical error.**

## 1. Commands

### Build, Lint, and Format

This project uses **Bun** for TypeScript and **Cargo** for Rust.

- **TypeScript:** `bun run build`
- **TypeScript Types:** `bun run typecheck` (MUST PASS before completing any TS task)
- **TypeScript Lint:** `bun run lint` (ESLint)
- **TypeScript Format:** `bun run fmt`
- **Rust Build:** `cargo build`
- **Rust Lint:** `cargo clippy --all-targets --all-features`
- **Rust Format:** `cargo fmt`

### Testing

- **TypeScript (All):** `bun test`
- **TypeScript (Single File):** `bun test <path/to/file.test.ts>`
- **Rust (All):** `cargo test`
- **Rust (Single Module/Function):** `cargo test <module_or_function_name>`

## 2. Code Style & Architecture Guidelines

### Language Boundary (CRITICAL)

- **Rust (Hot Path):** ALL logic from signal detection to transaction submission MUST be in Rust. This includes signal detection, decision-making, transaction construction, bundle submission, and economy settlement.
- **TypeScript (Control Plane):** Handles ONLY monitoring, configuration, social media (VIRAL), data analysis, and API integrations. **NEVER use TS in the hot path.**

### Module Communication

Agents communicate _exclusively_ through Redis pub/sub channels:

- `recon:signals`, `mint:deployed`, `detect:classifications`, `detect:alerts`, `oracle:predictions`, `risk:alerts`, `risk:settlement`, `txeng:submitted`, `viral:posts`, `viral:narratives`.
- **Envelope Format:** `{ timestamp, module, event_type, payload }`

### Rust Guidelines

- Use `anyhow` for application-level error handling.
- Use `thiserror` for library error types.
- Ensure exhaustive error handling; never silently swallow errors on the hot path.
- Use `tracing` for instrumentation and logging.

### TypeScript Guidelines

- Use strict typing. `zod` is available for runtime validation.
- Ensure files are ES Modules.
- Use idiomatic TS naming: `camelCase` for variables/functions, `PascalCase` for classes/types.

### VIRAL Module Constraints (Social Media)

- **Scope:** Automated posting to X/Telegram/Discord for bait clones, narrative seeding via LLMs, engagement tracking.
- **Rules:** All mainnet bait tokens must be indistinguishable from genuine clone tokens on-chain (provenance tags are internal only).

## 3. Rate Limits, Budget, and Safety constraints (RISK Module)

### Financial and API Constraints

- **Max LLM Budget:** $10/day (hard cap). This includes VIRAL LLM generation.
- **Max Clone Deployments:** 200/day across all networks, 30/hour burst cap.
- **Token Observations:** Uncapped (data ingestion from DexScreener/WSS is free).
- **Internal Economy:** Settle inter-agent service payments atomically via Redis `MULTI/EXEC` in micro-USD.

### Circuit Breakers (clone deployments & LLM budget)

- **maxClonesPerHour:** 30 / **maxClonesPerDay:** 200
- **Green:** All clear
- **Yellow:** ≥ 40% of clone daily budget used
- **Orange:** ≥ 70% of hourly or daily clone budget, or LLM approaching limit
- **Red:** ≥ 90% of clone daily budget or LLM daily budget exhausted

## 4. Agent Mechanical Overrides

- **Dependency Discipline:** Use ONLY `bun` for TypeScript dependencies (`bun.lock` exists). Never use `npm` or `yarn`.
- **Git Hygiene:** NEVER append `Co-Authored-By: Claude` to commit messages.
- **Verification:** You MUST run `bun run typecheck` and `bun run lint` (or `cargo test`/`cargo clippy`) after making changes. Do not claim success if these fail.
- **Dead Code:** Clean up unused imports, dead props, and debug logs (Step 0) before starting structural refactors.
- **Context Management:** For files > 500 LOC, use offset/limit to read chunks.
