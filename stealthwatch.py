#!/usr/bin/env python3
"""
StealthWatch v1.0 — Real-time Obscure Edge Monitor
====================================================
Re-scans Polymarket every 15 minutes for new obscure edge signals.
Pushes HIGH/MEDIUM edge alerts to Telegram. Tracks history to avoid dupes.

Usage:
    python3 stealthwatch.py                  # foreground, scan every 15min
    python3 stealthwatch.py --once           # single scan + alert
    python3 stealthwatch.py --daemon         # background daemon mode
    
Env vars:
    TELEGRAM_BOT_TOKEN   — Telegram bot token (from @BotFather)
    TELEGRAM_CHAT_ID     — Chat ID to send alerts to (default: from env)
"""

import json
import os
import subprocess
import sys
import time
import hashlib
from datetime import datetime, timezone
from pathlib import Path

# ============================================================================
# Configuration
# ============================================================================

GAMMA_IP = "104.18.34.205"
HOST = "gamma-api.polymarket.com"
SCAN_INTERVAL = 900  # 15 minutes
STATE_FILE = Path.home() / ".stealthwatch_state.json"

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_HOME_CHANNEL", os.environ.get("TELEGRAM_ALLOWED_USERS", ""))

# Edge detection thresholds
VOLUME_MAX = 100_000
VOLUME_MIN = 50
EDGE_DEV_HIGH = 0.25
EDGE_DEV_MED = 0.15
EDGE_PRICE_MIN = 0.10
EDGE_PRICE_MAX = 0.90


# ============================================================================
# Market Fetching
# ============================================================================

def fetch_markets(pages: int = 3) -> list:
    """Fetch Polymarket markets via DNS bypass."""
    all_markets = []
    for offset in range(0, pages * 100, 100):
        url = f"https://{HOST}/markets?limit=100&offset={offset}"
        try:
            result = subprocess.run(
                [
                    "curl", "-s",
                    "--resolve", f"{HOST}:443:{GAMMA_IP}",
                    url,
                    "-H", f"Host: {HOST}",
                    "-H", "User-Agent: StealthWatch/1.0",
                    "--max-time", "15",
                ],
                capture_output=True, text=True, timeout=20,
            )
            if result.returncode == 0:
                data = json.loads(result.stdout)
                if isinstance(data, list):
                    all_markets.extend(data)
                    if len(data) < 100:
                        break
        except Exception as e:
            print(f"  fetch error offset={offset}: {e}", file=sys.stderr)
    return all_markets


def parse_market(m: dict) -> dict:
    """Parse market into standardized fields."""
    try:
        vol = float(m.get("volume", 0) or 0)
    except (ValueError, TypeError):
        vol = 0.0

    prices_raw = m.get("outcomePrices", "[]")
    if isinstance(prices_raw, str):
        try: prices_raw = json.loads(prices_raw)
        except: prices_raw = []
    if isinstance(prices_raw, list) and len(prices_raw) >= 2:
        try: yes = float(prices_raw[0])
        except: yes = 0.5
    else:
        yes = 0.5

    question = m.get("question") or m.get("title") or "unknown"
    slug = m.get("slug", "")

    return {
        "question": question,
        "volume": vol,
        "yes_price": yes,
        "deviation": abs(yes - 0.50),
        "slug": slug,
        "condition_id": m.get("conditionId", ""),
    }


def detect_edge(market: dict) -> str | None:
    """Detect edge signal. Returns 'HIGH', 'MEDIUM', or None."""
    vol = market["volume"]
    yes = market["yes_price"]
    dev = market["deviation"]

    if vol < VOLUME_MIN or vol > VOLUME_MAX:
        return None
    if yes < EDGE_PRICE_MIN or yes > EDGE_PRICE_MAX:
        return None
    if dev > EDGE_DEV_HIGH:
        return "HIGH"
    if dev > EDGE_DEV_MED:
        return "MEDIUM"
    return None


def market_id(market: dict) -> str:
    """Stable ID for deduplication."""
    raw = market.get("condition_id") or market.get("slug") or market["question"]
    return hashlib.md5(raw.encode()).hexdigest()[:12]


# ============================================================================
# State Management
# ============================================================================

def load_state() -> dict:
    """Load seen signals from state file."""
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            pass
    return {"seen": {}, "last_scan": None, "total_scans": 0}


def save_state(state: dict):
    STATE_FILE.write_text(json.dumps(state, indent=2))


def is_new_signal(mid: str, state: dict) -> bool:
    """Check if this signal hasn't been alerted before."""
    return mid not in state["seen"]


def mark_seen(mid: str, signal: str, state: dict):
    state["seen"][mid] = {
        "first_seen": datetime.now(timezone.utc).isoformat(),
        "signal": signal,
    }
    # Prune old entries (> 7 days)
    cutoff = datetime.now(timezone.utc).isoformat()
    state["seen"] = {
        k: v for k, v in state["seen"].items()
        if (datetime.now(timezone.utc) - datetime.fromisoformat(v["first_seen"])).days < 7
    }


# ============================================================================
# Telegram Alerts
# ============================================================================

def send_telegram(text: str) -> bool:
    """Send alert to Telegram."""
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        print("  Telegram not configured (set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)", file=sys.stderr)
        return False

    try:
        result = subprocess.run(
            [
                "curl", "-s",
                f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
                "-d", f"chat_id={TELEGRAM_CHAT_ID}",
                "-d", f"text={text}",
                "-d", "parse_mode=HTML",
                "--max-time", "10",
            ],
            capture_output=True, text=True, timeout=15,
        )
        if result.returncode == 0:
            resp = json.loads(result.stdout)
            return resp.get("ok", False)
    except Exception as e:
        print(f"  Telegram error: {e}", file=sys.stderr)
    return False


def format_alert(market: dict, signal: str) -> str:
    """Format a market edge alert for Telegram."""
    emoji = "⬆" if signal == "HIGH" else "↑"
    q = market["question"][:100]
    vol = market["volume"]
    yes = market["yes_price"]
    dev = market["deviation"]

    # Pick category heuristically
    cat = "unknown"
    ql = q.lower()
    if any(kw in ql for kw in ["temperature", "°", "celsius", "fahrenheit"]): cat = "🌡 temp"
    elif any(kw in ql for kw in ["russia", "ukraine", "iran", "china", "taiwan", "strait"]): cat = "🌍 geo"
    elif any(kw in ql for kw in ["relegat", "qualify", "championship", "league"]): cat = "⚽ sports"
    elif any(kw in ql for kw in ["sentence", "prison", "verdict", "guilty"]): cat = "⚖ legal"
    elif any(kw in ql for kw in ["bitcoin", "ethereum", "crypto", "hashrate"]): cat = "₿ crypto"
    elif any(kw in ql for kw in ["release", "launch", "gta", "iphone", "feature"]): cat = "💻 tech"
    elif any(kw in ql for kw in ["rain", "snow", "storm", "hurricane"]): cat = "🌪 weather"

    return (
        f"{emoji} <b>{signal} EDGE</b> {cat}\n"
        f"<b>{q}</b>\n"
        f"Vol: ${vol:,.0f} | Yes: {yes:.1%} | Edge: ±{dev:.0%}\n"
        f"<code>https://polymarket.com/event/{market.get('slug', '')}</code>"
    )


# ============================================================================
# Scanner
# ============================================================================

def scan_and_alert(pages: int = 3, once: bool = False):
    """Main scan loop."""
    state = load_state()
    print(f"◆ StealthWatch v1.0 — {datetime.now().strftime('%H:%M:%S UTC')}", file=sys.stderr)
    print(f"  State: {len(state['seen'])} seen signals, {state['total_scans']} scans", file=sys.stderr)

    while True:
        print(f"\n→ Scanning Polymarket...", file=sys.stderr)
        markets = fetch_markets(pages)
        print(f"  {len(markets)} markets loaded", file=sys.stderr)

        high_signals = []
        med_signals = []

        for m in markets:
            parsed = parse_market(m)
            signal = detect_edge(parsed)
            if not signal:
                continue

            mid = market_id(parsed)
            if is_new_signal(mid, state):
                parsed["signal"] = signal
                if signal == "HIGH":
                    high_signals.append(parsed)
                else:
                    med_signals.append(parsed)
                mark_seen(mid, signal, state)

        state["last_scan"] = datetime.now(timezone.utc).isoformat()
        state["total_scans"] += 1

        # Sort by deviation (strongest edge first)
        high_signals.sort(key=lambda m: m["deviation"], reverse=True)
        med_signals.sort(key=lambda m: m["deviation"], reverse=True)

        print(f"  HIGH: {len(high_signals)} new | MED: {len(med_signals)} new", file=sys.stderr)

        # Alert on HIGH signals immediately
        for market in high_signals[:5]:
            alert = format_alert(market, "HIGH")
            print(f"  ALERT: {market['question'][:80]}", file=sys.stderr)
            if send_telegram(alert):
                print(f"    → Telegram sent", file=sys.stderr)
            time.sleep(1)  # rate limit

        # Batch MEDIUM signals
        if med_signals and len(med_signals) >= 2:
            batch = "\n".join([
                format_alert(m, "MEDIUM") for m in med_signals[:5]
            ])
            send_telegram(f"↑ <b>MEDIUM EDGE BATCH</b> ({len(med_signals)} signals)\n\n{batch}")

        save_state(state)

        if once:
            break

        print(f"  Sleeping {SCAN_INTERVAL}s...", file=sys.stderr)
        time.sleep(SCAN_INTERVAL)


# ============================================================================
# Main
# ============================================================================

def main():
    args = set(sys.argv[1:])
    pages = 3  # 300 markets

    if "--once" in args:
        scan_and_alert(pages=pages, once=True)
    elif "--daemon" in args:
        import daemonize
        # Simple backgrounding
        pid = os.fork()
        if pid > 0:
            print(f"Daemon PID: {pid}")
            sys.exit(0)
        scan_and_alert(pages=pages)
    else:
        scan_and_alert(pages=pages)


if __name__ == "__main__":
    main()
