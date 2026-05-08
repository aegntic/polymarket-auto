# OPSEC & Counter-Detection Playbook
## StealthTrace Stealth Hunter System — May 2026

This is the operator manual. Read it before you trade a single signal.
The hunters who skip OPSEC are the ones who show up in the next hunter's scan.

---

## 1. Wallet Architecture

### Generation
- Generate fresh wallets via `openssl rand -hex 32` — never use exchange wallets,
  hardware wallets you've used publicly, or addresses linked to any KYC'd account
- One wallet per market category max (sports wallet ≠ geopolitics wallet)
- Fund via decentralized bridges (Hop, Across) or fresh CEX withdrawal to a
  burner intermediate, then forward to final. Never fund directly from known
  CEX hot wallets
- Minimum 2-hop separation between fund source and trade wallet

### Rotation
- Rotate trading wallets every 14 days or after 20 trades, whichever comes first
- Retired wallets: drain to cold storage, never reactivate. A wallet that hasn't
  traded in 30+ days and suddenly activates on an obscure market IS a signal
- Maintain a pool of 5-8 pre-funded wallets, activate a new one on rotation

### Balances
- Keep per-wallet balance under $5k. Large balances on fresh wallets are flags
- Fund in 2-3 tranches of $500-1500, spaced 4-8h apart. Single $5k deposits
  to a 3-day-old wallet are the #1 funding trace signal

---

## 2. Trade Execution OPSEC

### Sizing
- NEVER copy exact position sizes from signals. If the signal wallet bought
  $847.32, you buy $712 or $1,103. Randomize within ±25%
- Cap position at 2% bankroll per obscure trade, 1% for non-LAYER-1+3 signals
- Never exceed 8% total daily risk across all obscure positions

### Timing
- Delay execution by 60-180 seconds after signal detection (randomized)
- If multiple signals fire simultaneously, stagger buys by 2-5 minutes
- Never buy within the same block as the signal wallet. On Polygon that's ~2s
  blocks — wait minimum 3 blocks
- Avoid trading in the first 30 minutes after the 09:00 AEST cron scan.
  That's when copycats flood in

### Order Type
- Use limit orders, not market. Market orders on $65k volume markets leave
  visible footprints
- Split large positions (>$200) across 2-3 limit orders at slightly different
  prices. Looks like organic interest, not a single copier

---

## 3. Decoy & Poisoning Strategy

### Decoy Wallets
- Maintain 2-3 "noise wallets" that trade randomly on medium-volume markets
  ($200k-$500k) with no real edge. They're there to pollute your own graph
- Occasional small losses ($20-50) on obscure markets you have NO position in.
  This breaks the "this wallet only wins on obscure stuff" pattern
- Decoys should have different funding sources than your trade wallets —
  ideally from different CEX accounts or bridges

### Graph Poisoning
- Once per week, fund a throwaway wallet ($100), make 3-4 bad obscure bets,
  lose 80%+, abandon it. This wallet shows up in hunter scans as "failed
  stealth wallet" — noise that buries your real signals
- If you detect YOUR wallet being copied, immediately have a decoy take the
  SAME position from a different wallet at the SAME time. The copier now has
  3 wallets to track instead of 1, and the decoy will lose (it's designed to)

### Social OPSEC
- Never post specific obscure wins in any chat, Discord, Telegram group.
  Not even "crypto friends." Not even "private" groups
- If someone asks how you caught a trade: "I just follow the smart money
  leaders on Polymarket." Boring, unverifiable, deflects attention
- No screenshots of positions or PnL. Ever. Screenshots are the #1 way
  hunter operations get reverse-engineered

---

## 4. Network & Infrastructure

### Connection
- VPN mandatory for ALL trading activity. Rotate exit node every 48h
- Residential proxies preferred over datacenter IPs. Polymarket and Polygonscan
  both fingerprint datacenter ranges
- Never connect to Polymarket from your home IP. Not once. Not even to check
  a position. Use a separate device or always-on VPN

### VPS
- Dedicated VPS (Hetzner, Netcup, or OVH) for scanner operations
- No port forwarding except SSH (key-only, no password)
- Fail2ban active with 3-strike ban
- No web dashboards exposed to public internet. If you need Grafana, use
  WireGuard tunnel or Cloudflare Tunnel with authentication
- Separate VPS for trading execution vs scanner. If scanner gets compromised,
  trading wallet keys aren't on the same machine

### API Keys
- Rotate Polygonscan API keys every 7 days. Free tier gives 5 calls/sec —
  register 3-4 accounts, cycle them
- Never hardcode keys. Use env vars or vault (pass, gopass, 1Password CLI)
- Each Docker instance gets its own API key pool

---

## 5. Copycat Detection

### Signals You're Being Hunted
- Volume on an obscure market you're in spikes 3x+ within 30 minutes of your
  entry, but no news/social chatter explaining it
- Two or more wallets enter the same obscure marketId within 10 blocks of
  your entry, with position sizes within 30% of yours
- A wallet that's never traded this category before suddenly appears on your
  exact market, at your exact timing

### Response Protocol
1. **IMMEDIATE**: Cease all new positions. Let existing positions ride.
2. **ANALYZE**: Run `stealthtrace.py --address YOUR_WALLET` to see if you
   now appear in funding trace results. If yes, you're burned
3. **DECOY**: Flood the market with 2-3 small opposite-side orders from decoy
   wallets. Break the pattern
4. **ROTATE**: If copycat volume persists across 2+ markets, rotate ALL
   active wallets within 4 hours. Burn the old ones completely
5. **PAUSE**: 48-hour full trading halt. Let the hunters move on

### False Positives
- Single copycat on a market that just resolved favorably: probably organic.
  Markets resolve, winners show up. Don't overreact
- Copycat on a market that hit social media: the edge is public now. Exit,
  don't rotate

---

## 6. Kill-Switch & Emergency Protocols

### Automatic Kill-Switch Triggers
- 3 consecutive obscure copies lose money → pause pipeline 48h
- Any wallet balance drops below $100 → auto-drain to cold storage, retire
- Scanner detects own wallet in funding trace → immediate rotate
- Polygonscan API returns 429 (rate limit) for >60s → pause all instances
  15 minutes

### Manual Emergency
If you suspect compromise (unexpected VPS logins, strange API key usage,
wallet balance changes you didn't make):
1. `docker compose down` all scanner instances
2. Revoke ALL API keys from provider dashboards
3. Transfer all trade wallet funds to cold storage
4. SSH into VPS, `passwd -l` all non-root accounts, check `last` and
   `/var/log/auth.log`
5. Do NOT restart for 72h. Let the window pass

---

## 7. Legal Posture

- All data used is publicly available on-chain. No insider trading claim
  can stick when the source is Polygonscan + Polymarket public APIs
- Never access non-public Polymarket endpoints, internal APIs, or employee
  resources. The edge must come from public data processing, not access
- If you have a day job at a trading firm, hedge fund, or exchange: STOP.
  You have actual insider information obligations. This system is for
  independent operators only
- Log nothing that could be construed as coordination. No group DMs
  discussing "let's all buy X." Solo operation only

---

## 8. The Ultimate Exit: Burn & Rebuild

If your edge starts appearing in public smart money maps, you're done.
The lifecycle of a stealth strategy:

1. **Discovery phase** (weeks 1-3): You find patterns no one else sees
2. **Exploitation phase** (weeks 3-12): You print consistently
3. **Copycat phase** (weeks 8-16): Others notice. Edge compresses
4. **Public phase** (week 16+): Your signals are in everyone's scanner

When you hit Phase 3:
1. Drain all wallets to cold storage
2. Delete all scanner state files, Docker volumes, databases
3. Generate entirely new seed whale list (different sources, different
   categories)
4. Deploy fresh Docker instances with new API keys, new proxies, new wallets
5. Resume within 48h with zero connection to previous operation

The rebuild must look like a completely different operator. Different
wallet age patterns, different category focus, different sizing patterns.
Never rebuild in the same category that got copied — that's asking to be
re-detected immediately.

---

## 9. Real Case Study: The 11k Reverse-Engineering

March 2026. Operator "K" ran a clean stealth operation: 4 wallets, funded
from a single Binance withdrawal chain, copying obscure La Liga markets.
Win rate 71% over 6 weeks, $11,200 profit.

How he got caught:
1. ALL four wallets funded from the SAME intermediate address
2. ALL four bought the EXACT same position size ($500 exactly, every trade)
3. ALL four entered within 3 blocks of each other on every trade
4. He posted one screenshot in a "private" trading group showing PnL. Someone
   in that group ran a scanner. Traced the funding. Copied him. Drained the
   edge in 72 hours

What he should have done:
- 4 different funding sources (different CEX accounts, different bridges)
- Randomized sizes ($350-$650 range)
- Staggered entries (30-120 second delays)
- Never posted the screenshot

The hunter who reverse-engineered him made $4,200 in 3 days copying.
Then the edge compressed to zero and everyone lost on the next 5 trades.
Everyone. The hunter who copied too aggressively lost $1,800 of the $4,200
because he didn't have an exit plan.

---

## 10. Daily OPSEC Checklist

Before each trading session:
- [ ] VPN active, exit node <48h old
- [ ] All API keys valid (test one call)
- [ ] No wallet has >$5k balance
- [ ] Decoy wallets have recent activity (last 72h)
- [ ] Scanner shows zero matches for own wallets

After each trading session:
- [ ] Clear browser cookies/cache for Polymarket domain
- [ ] Rotate VPN exit node
- [ ] Check auth.log for unexpected SSH attempts
- [ ] Verify no position >2% bankroll

Weekly:
- [ ] Rotate all Polygonscan API keys
- [ ] Rotate at least one trading wallet
- [ ] Flush and reseed decoy wallets
- [ ] Review scanner logs for self-detection
- [ ] Update seed whale list from new sources

---

The hunters who survive are the ones who treat OPSEC as a feature,
not an afterthought. The code finds the edge. The OPSEC keeps it.
