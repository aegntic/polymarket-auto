#!/usr/bin/env python3
"""
StealthTrace v2.1 — Live Polymarket Obscure Market Scanner
===========================================================
Zero-dependency live scanner (uses curl subprocess for DNS bypass).
Identifies obscure low-volume markets with potential info asymmetry edge.

Usage:
    python3 stealthscan.py                  # human-readable output
    python3 stealthscan.py --json           # JSON output
    python3 stealthscan.py --categories     # category breakdown only
"""

import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from collections import defaultdict

# ============================================================================
# Configuration
# ============================================================================

GAMMA_IP = "104.18.34.205"
OBSCURE_VOLUME_MAX = 100_000
OBSCURE_VOLUME_MIN = 50

CATEGORY_KEYWORDS = {
    "city_temperature": ["temperature", "°F", "°C", "high temp", "low temp", "celsius"],
    "minor_geopolitics": ["strait", "hormuz", "protest", "sub-", "single-city"],
    "long_tail_tech": ["feature", "release date", "rollout", "ship date", "gta", "iphone"],
    "niche_esports": ["map ", "odd/even", "total kills", "set ", "games o/u"],
    "obscure_economic": ["fed district", "basis trade", "regional", "commodity"],
    "weather_specific": ["rain", "snow", "humidity", "wind speed", "precipitation"],
    "minor_sports": ["qualify", "division", "frame", "runs", "wickets"],
    "specific_crypto": ["hashrate", "difficulty", "gas", "staking"],
}


def curl_get(url: str, host: str, timeout: int = 15) -> dict | list | None:
    """Fetch via curl with --resolve for DNS bypass."""
    try:
        result = subprocess.run(
            [
                "curl", "-s",
                "--resolve", f"{host}:443:{GAMMA_IP}",
                url,
                "-H", f"Host: {host}",
                "-H", "User-Agent: StealthTrace/2.1",
                "-H", "Accept: application/json",
                "--max-time", str(timeout),
            ],
            capture_output=True,
            text=True,
            timeout=timeout + 5,
        )
        if result.returncode == 0 and result.stdout.strip():
            return json.loads(result.stdout)
    except Exception as e:
        print(f"  curl error: {e}", file=sys.stderr)
    return None


def fetch_markets(limit: int = 200) -> list:
    """Fetch Polymarket markets with pagination."""
    all_markets = []
    host = "gamma-api.polymarket.com"

    for offset in range(0, limit, 100):
        url = f"https://{host}/markets?limit=100&offset={offset}"
        data = curl_get(url, host)
        if isinstance(data, list):
            all_markets.extend(data)
            if len(data) < 100:
                break
        else:
            break

    return all_markets


def parse_market(m: dict) -> dict:
    """Parse a market dict into standardized fields."""
    volume = 0.0
    for key in ("volume", "volumeNum", "volumeClob"):
        try:
            volume = float(m.get(key, 0))
            if volume > 0:
                break
        except (ValueError, TypeError):
            pass

    # Parse outcomePrices (JSON string or list)
    prices_raw = m.get("outcomePrices", "[]")
    if isinstance(prices_raw, str):
        try:
            prices_raw = json.loads(prices_raw)
        except json.JSONDecodeError:
            prices_raw = []
    if isinstance(prices_raw, list) and len(prices_raw) >= 2:
        try:
            yes_price = float(prices_raw[0])
        except (ValueError, TypeError):
            yes_price = 0.5
    else:
        yes_price = 0.5

    question = m.get("question") or m.get("title") or "unknown"

    return {
        "question": question,
        "volume": volume,
        "yes_price": yes_price,
        "slug": m.get("slug", ""),
        "volume24h": float(m.get("volume24hrClob", 0) or 0),
        "end_date": m.get("endDateIso", ""),
    }


def categorize(question: str) -> str:
    q = question.lower()
    for cat, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in q:
                return cat
    return "other"


def scan(markets: list) -> dict:
    obscure = []
    cats = defaultdict(lambda: {"count": 0, "total_volume": 0.0, "examples": []})

    for m in markets:
        parsed = parse_market(m)
        vol = parsed["volume"]
        if vol < OBSCURE_VOLUME_MIN or vol > OBSCURE_VOLUME_MAX:
            continue

        q = parsed["question"]
        cat = categorize(q)
        yes = parsed["yes_price"]
        dev = abs(yes - 0.50)

        if dev > 0.30:
            signal = "HIGH"
        elif dev > 0.15:
            signal = "MEDIUM"
        else:
            signal = "LOW"

        entry = {**parsed, "category": cat, "edge_signal": signal, "price_deviation": dev}
        obscure.append(entry)

        cats[cat]["count"] += 1
        cats[cat]["total_volume"] += vol
        if len(cats[cat]["examples"]) < 3:
            cats[cat]["examples"].append(q[:80])

    obscure.sort(key=lambda x: x["price_deviation"], reverse=True)
    return {"markets": obscure, "categories": dict(cats), "total": len(obscure)}


def format_output(scan: dict) -> str:
    out = []
    out.append("=" * 64)
    out.append("  STEALTH OBSCURE EDGE HUNTER v1.0 — LIVE MARKET SCAN")
    out.append(f"  {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}")
    out.append(f"  Mode: Market scanner (Polygonscan key needed for wallet tracing)")
    out.append("=" * 64)
    out.append("")

    cats = scan.get("categories", {})
    sorted_cats = sorted(cats.items(), key=lambda x: x[1]["count"], reverse=True)

    out.append("◆ OBSCURE CATEGORIES (volume < $100k, edge potential)")
    out.append("")
    for name, stats in sorted_cats:
        avg_vol = stats["total_volume"] / max(stats["count"], 1)
        out.append(f"  {name}: {stats['count']} markets, avg ${avg_vol:,.0f}")
        for ex in stats["examples"][:2]:
            out.append(f"    → {ex}")
        out.append("")

    markets = scan.get("markets", [])
    high = [m for m in markets if m["edge_signal"] == "HIGH"]
    med = [m for m in markets if m["edge_signal"] == "MEDIUM"]

    out.append(f"◆ TOP EDGE SIGNALS: {len(high)} HIGH, {len(med)} MEDIUM, {len(markets)} total")
    out.append("")

    for i, m in enumerate(markets[:20]):
        sig = m["edge_signal"]
        marker = "⬆" if sig == "HIGH" else "↑" if sig == "MEDIUM" else "·"
        out.append(
            f"  {marker} [{sig:6s}] [{m['category']:22s}] "
            f"\${m['volume']:>9,.0f} | {m['yes_price']:.3f} | {m['question'][:90]}"
        )

    out.append("")
    out.append(f"  Total obscure: {scan['total']}  |  HIGH edge: {len(high)}  |  MEDIUM: {len(med)}")
    out.append("")
    out.append("◆ STEALTH TOP 3 CATEGORIES TO MONITOR")
    for i, (name, stats) in enumerate(sorted_cats[:3]):
        out.append(f"  {i+1}. {name} — {stats['count']} markets, info asymmetry potential")
    out.append("")
    out.append("  Full wallet tracing: export POLYGONSCAN_API_KEY=your_key")
    out.append("  then: python3 stealthtrace.py --top 5")
    out.append("")
    out.append(f"TOTAL DAILY RISK: ≤8% bankroll")
    out.append("=" * 64)

    return "\n".join(out)


def main():
    args = set(sys.argv[1:])

    print("◆ StealthTrace v2.1 — Fetching data...", file=sys.stderr)
    markets = fetch_markets(200)

    if not markets:
        print("ERROR: No market data. Check network.", file=sys.stderr)
        sys.exit(1)

    print(f"→ {len(markets)} markets loaded", file=sys.stderr)

    result = scan(markets)
    print(f"→ {result['total']} obscure markets found", file=sys.stderr)

    if "--json" in args:
        print(json.dumps(result, indent=2, default=str))
    else:
        print(format_output(result))


if __name__ == "__main__":
    main()
