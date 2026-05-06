# Task 3: Simulation Fallback Implementation

## Summary
Implemented a client-side real-time data simulation fallback that activates automatically when the WebSocket service (port 3003) is disconnected, ensuring the dashboard always has live-looking data.

## Files Modified
- **`/src/hooks/useSimulation.ts`** (NEW) — Core simulation hook
- **`/src/hooks/useWebSocket.ts`** (MODIFIED) — Integrated simulation fallback
- **`/src/lib/store.ts`** (MODIFIED) — Added `simulationActive` state

## Implementation Details

### useSimulation.ts
- Mirrors the exact same data format and timing as the WS service (mini-services/trade-feed/index.ts)
- Same market names, wallet addresses, agent reasonings, news headlines as WS service
- Generates properly typed `Trade`, `AgentDecision`, `Market`, `NewsEvent` objects directly (no normalization needed since we control the format)
- Uses `useDashboardStore.getState()` inside callbacks to avoid stale closure issues
- Uses `activeRef` to track simulation state in real-time across async callbacks
- Tracks all timers in `timersRef` for clean teardown
- Running capital persists across activation cycles (starts at $25 or picks up from current `liveCapital`)
- Initial burst at 1s/2.5s/4s/5.5s so data appears quickly after disconnection

### useWebSocket.ts Changes
- Added `simulationActive` local state + sync to store via `setSimulationActive`
- On WS `connect`: clears reconnect timeout, stops simulation immediately
- On WS `disconnect`: starts simulation after 3s delay (prevents flicker during brief reconnects)
- On WS `connect_error`: starts simulation after 2s if never connected
- Added handler for `initial-state` event from WS (capital sync)
- Set `reconnectionAttempts: Infinity` so WS keeps trying to reconnect
- Returns `{ simulationActive }` for component use

### store.ts Changes
- Added `simulationActive: boolean` field (default: `false`)
- Added `setSimulationActive: (active: boolean) => void` action
- `liveCapital` is updated from both sources (WS `capital-update` event + simulation 5s interval)

## Data Flow
```
WS Connected → WS data → normalize → store actions
WS Disconnected (3s delay) → simulation → store actions (direct, no normalization needed)
WS Reconnects → stop simulation → WS data again
```

## Key Design Decisions
1. **Delay before simulation start**: 3s on disconnect, 2s on initial connect failure — prevents visual flicker during quick WS reconnects
2. **Direct store access in callbacks**: Using `useDashboardStore.getState()` avoids stale closure issues with Zustand selectors inside setTimeout callbacks
3. **Ref-based active tracking**: `activeRef` ensures timer callbacks always check the current simulation state, even if React hasn't re-rendered
4. **Capital continuity**: Simulation picks up from current `liveCapital` value when activated, so capital doesn't reset when switching between WS and simulation
