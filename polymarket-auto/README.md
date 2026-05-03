# polymarket-auto

Autonomous Polymarket trading agent with real-time dashboard.

xAI Grok-4.20 powered edge detection, Kelly criterion position sizing, and wallet intelligence.

## Stack

- **Next.js 16** + Turbopack (full-stack React framework)
- **Prisma** + SQLite (schema, migrations, ORM)
- **shadcn/ui** + Tailwind CSS (dashboard components)
- **xAI Grok** (agent reasoning and market analysis)
- **Bun** (runtime and package manager)

## Architecture

```
src/
  app/
    api/
      agent-decide/   # AI agent decision endpoint
      agent/          # Agent state management
      kelly/          # Kelly criterion position sizer
      markets/        # Polymarket market data
      news/           # News sentiment feed
      performance/    # Portfolio analytics
      trades/         # Trade execution and history
      wallets/        # Wallet tracking and leaderboard
  components/
    dashboard/        # 40+ dashboard components
  hooks/              # Custom React hooks
  lib/                # Shared utilities

prisma/
  schema.prisma       # Wallet, Market, Trade, AgentState, NewsEvent, AgentDecision models
```

## Agent Logic

The agent scans top wallets by 90-day performance, computes edge scores (`sqrt(tradeCount * avgPosSize) / 10`), tracks their positions on active Polymarket markets, and uses xAI Grok for reasoning about trade decisions. Kelly criterion determines position sizing.

Key models in the schema:

| Model | Purpose |
|-------|---------|
| `Wallet` | Tracked wallets with edge scores and PnL |
| `Market` | Polymarket markets with pricing and mispricing detection |
| `Trade` | Individual trades linked to wallets and markets |
| `AgentState` | Agent runtime state, capital, Sharpe ratio |
| `NewsEvent` | Sentiment-scored news events |
| `AgentDecision` | Full decision log with reasoning and confidence |
| `ConnectedWallet` | User-connected wallets for trade execution |

## Dashboard

Real-time dashboard with market scanner, trade feed, wallet leaderboard, agent console, risk analysis, strategy backtesting, correlation matrix, order book depth, and more.

## Getting Started

```bash
bun install
cp .env.local.example .env.local  # add your API keys
bun run db:push
bun run dev
```

Required env vars:
- `DATABASE_URL` — SQLite connection string
- `XAI_API_KEY` — xAI API key for Grok
- `POLYMARKET_API_KEY` — Polymarket CLOB API key (for live trading)

## Status

Work in progress. Active development on the `fix/p0-p3-systematic` branch.

## License

MIT
