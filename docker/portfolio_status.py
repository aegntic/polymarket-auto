#!/usr/bin/env python3
"""Live portfolio status — shows all positions with unrealized P&L."""

import sys
import os
import json
import subprocess
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from trade_executor import TradeExecutor

GAMMA_IP = os.environ.get("POLYMARKET_GAMMA_IP", "104.18.34.205")
GAMMA_HOST = "gamma-api.polymarket.com"

e = TradeExecutor(os.environ.get("POLYMARKET_PRIVATE_KEY", ""))
trades = e.clob.get_trades()

positions = defaultdict(lambda: {"yes": 0, "no": 0, "cost": 0.0})
for t in trades:
    mid = t["market"]
    out = t["outcome"]
    side = t["side"]
    size = float(t["size"])
    price = float(t["price"])
    if side == "BUY":
        if out == "Yes":
            positions[mid]["yes"] += size
        else:
            positions[mid]["no"] += size
        positions[mid]["cost"] += size * price

result = subprocess.run(
    [
        "curl",
        "-s",
        "--resolve",
        f"{GAMMA_HOST}:443:{GAMMA_IP}",
        f"https://{GAMMA_HOST}/markets?limit=500&active=true",
        "-H",
        f"Host: {GAMMA_HOST}",
        "--max-time",
        "15",
    ],
    capture_output=True,
    text=True,
    timeout=20,
)
markets = json.loads(result.stdout) if result.returncode == 0 else []
market_map = {m.get("conditionId", ""): m for m in markets if m.get("conditionId")}

print("=" * 78)
print("  POLYAGENT PORTFOLIO — LIVE STATUS")
print("=" * 78)

total_cost = 0.0
total_value = 0.0

for mid, p in sorted(positions.items(), key=lambda x: -x[1]["cost"]):
    if p["yes"] == 0 and p["no"] == 0:
        continue
    m = market_map.get(mid, {})
    q = m.get("question", mid[:30] + "...")
    prices_raw = m.get("outcomePrices", "[]")
    if isinstance(prices_raw, str):
        try:
            prices_raw = json.loads(prices_raw)
        except Exception:
            prices_raw = []
    yes_now = float(prices_raw[0]) if isinstance(prices_raw, list) and prices_raw else 0
    no_now = (
        float(prices_raw[1])
        if isinstance(prices_raw, list) and len(prices_raw) > 1
        else 0
    )

    direction = "YES" if p["yes"] > 0 else "NO"
    shares = max(p["yes"], p["no"])
    if shares == 0:
        continue
    current_price = yes_now if direction == "YES" else no_now
    current_value = shares * current_price
    avg_price = p["cost"] / shares
    pnl = current_value - p["cost"]
    pnl_pct = (pnl / p["cost"] * 100) if p["cost"] > 0 else 0

    total_cost += p["cost"]
    total_value += current_value

    arrow = "+" if pnl >= 0 else "-"
    print(
        f"  {direction:3} {shares:7.1f}sh | avg ${avg_price:.3f} -> now ${current_price:.3f} | {arrow}${abs(pnl):.2f} ({pnl_pct:+.0f}%)"
    )
    print(f"    {q[:70]}")
    print()

bal = e.get_balance()
net = total_value + bal
roi = (net - 100) / 100 * 100

print("=" * 78)
print(f"  Invested:    ${total_cost:.2f}")
print(f"  Market val:  ${total_value:.2f}")
print(f"  Unrealized:  ${total_value - total_cost:+.2f}")
print(f"  Cash (pUSD): ${bal:.2f}")
print(f"  Portfolio:   ${net:.2f} (started $100) ROI: {roi:+.1f}%")
print("=" * 78)
