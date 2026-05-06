# FEAT-2+FEAT-3: Wallet Detail Modal & Portfolio Risk Analysis

## Task Summary
Added two major features to the Polymarket dashboard:

### FEAT-2: Wallet Detail Modal
- **File Created**: `src/components/dashboard/WalletDetailModal.tsx`
- **Features**:
  - Dialog modal opens when clicking a wallet in the leaderboard
  - Shows full wallet address with copy button (copies to clipboard)
  - Display label (read-only)
  - Semicircle edge score gauge (SVG-based, color-coded by score)
  - 4 key stats: Win Rate, Total PnL, Total Trades, Avg Position Size
  - Performance mini chart (PnL over time using recharts AreaChart with gradient)
  - Recent Trades table (last 10 trades, fetched from /api/trades, filtered by walletId)
    - Columns: Market, Side, Size, Price, PnL, Date
  - Edge Analysis section with 3 cards:
    - Win Rate vs Market Average (with progress bar and comparison text)
    - Position Sizing vs Kelly Optimal (with progress bar)
    - Timing Analysis (Pre-event vs Post-event classification)
  - Dark cyberpunk styling matching existing dashboard
  - Framer Motion animation for modal open/close

- **File Modified**: `src/components/dashboard/WalletLeaderboard.tsx`
  - Added `useState<Wallet | null>` for selectedWallet
  - Added `cursor-pointer` class to wallet rows
  - Added `onClick={() => setSelectedWallet(wallet)}` to each row
  - Renders `<WalletDetailModal>` when a wallet is selected

### FEAT-3: Portfolio Risk Analysis
- **File Created**: `src/components/dashboard/RiskAnalysis.tsx`
- **Features**:
  - Risk Metrics Grid (2x3 layout):
    - Max Drawdown (% with red color)
    - Sharpe Ratio (color-coded: >2 green, 1-2 yellow, <1 red)
    - Sortino Ratio (calculated from performance data using downside deviation)
    - VaR 95% (Value at Risk from performance drawdowns)
    - Win/Loss Ratio (avg win size / avg loss size)
    - Profit Factor (gross profit / gross loss)
  - Drawdown Chart: recharts AreaChart with red gradient fill and max drawdown reference line
  - Monte Carlo Simulation: 100 paths, 30-day projection
    - Shows median path (solid cyan), 25th percentile (dashed red), 75th percentile (dashed cyan)
    - Uses agent's win rate and average position size for simulation
  - Risk Level Indicator: emoji + color-coded horizontal bar
    - Based on composite score of max drawdown, Sharpe, and VaR
    - Shows 🟢 Low / 🟡 Medium / 🔴 High Risk

- **File Modified**: `src/app/page.tsx`
  - Imported RiskAnalysis component
  - Added between PerformanceChart and AgentConsole in center column

## Lint Status
All lint checks pass with no errors.

## Data Dependencies
- `/api/trades` - for wallet trade history (existing, not modified)
- `/api/agent` - for agent state (existing, not modified)
- `/api/performance` - for performance data (existing, not modified)
