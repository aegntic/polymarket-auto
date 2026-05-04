# Sim-to-Production: polymarket-auto

## Current Architecture

- **Wallet**: RainbowKit + wagmi + viem on Polygon. WalletConnect project ID wired. Providers in layout. WalletConnectPanel + usePolymarketTrading hook functional. (Phase 1 COMPLETE)
- **API layer**: polymarket-api.ts (Gamma API with DNS bypass), markets/route.ts, trades/route.ts, edge-scorer.ts, risk-guardian.ts, agent-decide/route.ts, kelly/route.ts. All server-side. (Phase 2 MOSTLY COMPLETE)
- **Simulation**: useSimulation.ts still exists but is effectively dead code (imported in useWebSocket.ts but not called). useWebSocket.ts still attempts socket.io connection that always fails. Markets route has MOCK_MARKETS fallback.
- **State**: Zustand store with wallet state, live trades, agent decisions, toasts. Properly wired.
- **Trading hook**: usePolymarketTrading.ts — buyYes/buyNo with USDC approval, toast notifications, live trade feed.

## Remaining Simulation/Dead Code

| File | Issue |
|------|-------|
| `src/hooks/useSimulation.ts` | Entire file is dead code. Not called from page. |
| `src/hooks/useWebSocket.ts` | Imports useSimulation (unused). Tries socket.io that never connects. Normalizer functions unused. |
| `src/app/api/markets/route.ts` | MOCK_MARKETS array + fallback when API fails |
| `src/lib/edge-scorer.ts` | `getNewsSentiment()` returns hardcoded 0.55 placeholder |
| `src/lib/edge-scorer.ts` | `getPriceMomentum()` uses static prices, no time-series |
| `src/lib/trading-service.ts` | Contract addresses truncated (missing digits) |

## Phase 3: Real Data Pipeline (Current Phase)

### 3a. Replace WebSocket hook with polling hook
**Goal**: Dashboard shows live data via API polling, not dead socket.io

1. Create `src/hooks/useLiveData.ts` — React Query based polling hook:
   - Fetch `/api/markets` every 30s → updateMarket in store
   - Fetch `/api/edge-score?limit=10` every 60s → addAgentDecision from scores
   - Fetch `/api/trades?marketId=X` on market select → addLiveTrade
   - Fetch `/api/wallets` every 60s → wallet leaderboard
2. Update `page.tsx` — replace useWebSocket() with useLiveData()
3. Delete `src/hooks/useSimulation.ts`
4. Gut `src/hooks/useWebSocket.ts` → keep as empty stub or delete

**Verify**: Dashboard shows real Polymarket data. No socket.io errors in console.

### 3b. Fix contract addresses
**Goal**: Correct Polymarket contract addresses for real trading

1. Verify and fix addresses in trading-service.ts:
   - Conditional Tokens: `0x4D97DC6B1D9f8AD0a0a69377c3C299C69B32a3` → needs full 40-char hex
   - CLOB: `0x7dE91Bd53FbEaCBa3FbC5D9379c47dA95aF51` → needs full 40-char hex
2. Look up correct addresses from Polymarket docs

**Verify**: Addresses are valid 42-char hex (0x + 40 hex digits).

### 3c. Upgrade edge scorer signals
**Goal**: Replace placeholder signal calculations with real data

1. `getNewsSentiment()` — integrate with `/api/news` or xAI for real sentiment
2. `getPriceMomentum()` — fetch historical prices from Gamma API for time-series

**Verify**: Edge scores use real signal values, not hardcoded.

### 3d. Remove mock data fallback
**Goal**: Eliminate MOCK_MARKETS from markets route

1. Remove MOCK_MARKETS from `src/app/api/markets/route.ts`
2. Return empty array with warning on API failure instead
3. Keep DNS bypass in polymarket-api.ts (it's real infrastructure)

**Verify**: No mock data anywhere in source.

## Phase 4: Production Hardening (Next)

- Error boundaries on dashboard components
- Rate limiting on API routes
- Environment validation (fail fast on missing keys)
- Proper logging (structured, not console.log)
- Health check endpoint
- CORS config for production domain

## Edge Cases

- Wallet not connected: Dashboard still shows market data. Trading buttons disabled with connect prompt.
- API downtime (ISP block): DNS bypass via curl --resolve. If that fails too, show "API unavailable" not fake data.
- Transaction failures: usePolymarketTrading already handles with toast notifications.
- No edge traders in DB: edge-scorer falls back to 0.3 conviction. Acceptable.

## Verification Checklist (Phase 3a)

- [ ] `bun run build` passes
- [ ] Dashboard loads at localhost:3001 with real market data
- [ ] No socket.io errors in browser console
- [ ] No useSimulation references in active code
- [ ] Markets update on polling interval
- [ ] Wallet connect still works
