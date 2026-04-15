## LLM Model-Based Rate Limits

Updated from arbitrary limits (40/hr, 200/day) to model-based limits:

- maxPerHour: 200 (based on GPT-4o/Claude processing capacity)
- maxPerDay: 1000 (daily processing capacity)
- Budget remains $10/day

## Rate Limit Logic

Maintained green/orange/red levels based on percentage thresholds of model capacity:

- Green: ≤ 70% of capacity
- Orange: 70-90% of capacity
- Red: > 90% of capacity

## Auto Shutdown Removed

Emergency shutdown triggered by profitability target has been removed. System now requires manual intervention when target is achieved.

## All Other Features Intact

- Solana deployment with wallet integration
- 3x profitability tracking
- Agent-based monitoring (3 specialized agents)
- Circuit breakers for service protection
- Complete type safety
- Budget remains $10/day

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
