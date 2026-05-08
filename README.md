# PolyAgent

Autonomous Polymarket trading agent with real-time dashboard. AI-powered edge detection, Kelly criterion position sizing, and wallet intelligence.

## Stack

- **Next.js 16** + Turbopack
- **Prisma** + SQLite
- **shadcn/ui** + Tailwind CSS
- **xAI Grok-4.20** (agent reasoning)
- **RainbowKit** (wallet connection)
- **Bun** (runtime + package manager)

## Quick Start

```bash
bun install
cp .env.local.example .env.local
bun run db:push
bun run dev
```

Open http://localhost:3000

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | SQLite connection string (default: `file:./dev.db`) |
| `XAI_API_KEY` | Yes | xAI API key for Grok |
| `POLYMARKET_API_KEY` | For live trading | Polymarket CLOB API key |

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server |
| `bun run build` | Production build |
| `bun run start` | Start production server (port 3000) |
| `bun run db:push` | Sync database schema |
| `bun run db:migrate` | Run migrations |

## Architecture

```
src/
  app/
    api/
      agent/          # Agent state
      agent-decide/   # AI decision endpoint
      kelly/          # Kelly criterion position sizer
      markets/        # Polymarket market data
      news/           # News sentiment feed
      performance/    # Portfolio analytics
      trades/         # Trade execution + history
      wallets/        # Wallet tracking + leaderboard
  components/
    dashboard/        # Dashboard UI components
  hooks/              # Custom React hooks
  lib/                # Shared utilities + store

prisma/
  schema.prisma       # Database models
```

## Agent Logic

The agent scans top wallets by 90-day performance, computes edge scores, tracks positions on active Polymarket markets, and uses xAI Grok for trade reasoning. Kelly criterion determines position sizing.

## Dashboard

- **Overview** — Performance charts, portfolio timeline, wallet leaderboard, news feed, agent console, trade feed
- **Analytics** — Wallet network graph, activity heatmaps, PnL heatmaps, sentiment timeline, correlation matrix, trade clustering
- **Trading** — Wallet connect, market scanner, market depth, Kelly sizer, order book, strategy backtest, portfolio allocation
- **Risk & Strategy** — Deployment timeline, risk analysis, agent strategy panel, strategy comparison

## License

MIT
