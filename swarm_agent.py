#!/usr/bin/env python3
"""
PolyAgent Swarm Agent — Self-Learning Trading Engine
=====================================================
Autonomous agent that reads edge signals, executes trades,
tracks outcomes, and learns from PnL. Each agent instance
operates in a specific category slice. All agents share
a SQLite brain for cross-instance learning.

Architecture:
  Signal Detect → Risk Check → Execute → Track Outcome → Learn → Repeat

Usage:
    python3 swarm_agent.py                     # auto-detect category, start loop
    python3 swarm_agent.py --category sports   # force category
    python3 swarm_agent.py --once              # single decision cycle

Env vars:
    POLYMARKET_PRIVATE_KEY  — wallet private key for trading
    POLYGONSCAN_API_KEY     — for on-chain trade verification
    XAI_API_KEY             — for Grok analysis
    TELEGRAM_BOT_TOKEN      — for trade confirmations
    TELEGRAM_CHAT_ID
"""

import json
import os
import sys
import time
import sqlite3
import hashlib
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

try:
    import requests
    from urllib.parse import quote as url_quote
except ImportError:
    print("ERROR: pip install requests")
    sys.exit(1)

# Import our modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from trade_executor import TradeExecutor

# ============================================================================
# Config
# ============================================================================

BRAIN_DB = Path.home() / ".stealthtrace" / "swarm_brain.db"
SIGNAL_DB = Path.home() / ".stealthtrace" / "signals.db"
SCAN_INTERVAL = 900  # 15 minutes
MAX_POSITION_USDC = 10.0  # max per trade
MAX_DAILY_RISK = 40.0  # total daily exposure
MIN_EDGE_DEVIATION = 0.25  # minimum price deviation for edge
MIN_CONFIDENCE = 60

GAMMA_IP = "104.18.34.205"
HOST = "gamma-api.polymarket.com"

WM_BASE = os.environ.get("WORLDMONITOR_URL", "https://worldmonitor.app")
WM_CACHE_TTL = 300  # 5 minutes

TELEGRAM_TOKEN = os.environ.get(
    "TELEGRAM_BOT_TOKEN", "8797513938:AAHFLeW-8nQu8qtekAKibriifcIKmL1B2yE"
)
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "654439651")


# ============================================================================
# Swarm Brain (shared learning DB)
# ============================================================================


class SwarmBrain:
    """Shared SQLite brain for all swarm agents. Tracks trades, PnL, strategies."""

    def __init__(self):
        BRAIN_DB.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(BRAIN_DB))
        self._init_schema()

    def _init_schema(self):
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS trades (
                id TEXT PRIMARY KEY,
                agent_id TEXT,
                category TEXT,
                market_id TEXT,
                question TEXT,
                outcome TEXT,
                price REAL,
                size REAL,
                tx_hash TEXT,
                status TEXT DEFAULT 'pending',
                pnl REAL,
                edge_deviation REAL,
                confidence REAL,
                executed_at TEXT,
                resolved_at TEXT,
                notes TEXT
            );
            CREATE TABLE IF NOT EXISTS strategies (
                id TEXT PRIMARY KEY,
                category TEXT,
                strategy_name TEXT,
                params TEXT,
                total_trades INTEGER DEFAULT 0,
                wins INTEGER DEFAULT 0,
                total_pnl REAL DEFAULT 0.0,
                sharpe REAL,
                active INTEGER DEFAULT 1,
                updated_at TEXT
            );
            CREATE TABLE IF NOT EXISTS learnings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id TEXT,
                category TEXT,
                insight TEXT,
                pnl_impact REAL,
                created_at TEXT
            );
            CREATE TABLE IF NOT EXISTS agent_state (
                agent_id TEXT PRIMARY KEY,
                category TEXT,
                capital REAL DEFAULT 0,
                peak_capital REAL DEFAULT 0,
                daily_pnl REAL DEFAULT 0,
                daily_trades INTEGER DEFAULT 0,
                total_trades INTEGER DEFAULT 0,
                win_rate REAL DEFAULT 0,
                last_scan TEXT,
                last_trade TEXT,
                status TEXT DEFAULT 'active'
            );
        """)
        self.conn.commit()

    def log_trade(self, trade: dict):
        self.conn.execute(
            """
            INSERT OR REPLACE INTO trades (id, agent_id, category, market_id, question,
                outcome, price, size, tx_hash, status, edge_deviation, confidence, executed_at, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                trade["id"],
                trade["agent_id"],
                trade["category"],
                trade["market_id"],
                trade["question"],
                trade["outcome"],
                trade["price"],
                trade["size"],
                trade.get("tx_hash"),
                trade.get("status", "pending"),
                trade.get("edge_deviation"),
                trade.get("confidence"),
                trade.get("executed_at", datetime.now(timezone.utc).isoformat()),
                trade.get("notes"),
            ),
        )
        self.conn.commit()

    def update_pnl(self, trade_id: str, pnl: float, status: str = "resolved"):
        self.conn.execute(
            "UPDATE trades SET pnl = ?, status = ?, resolved_at = ? WHERE id = ?",
            (pnl, status, datetime.now(timezone.utc).isoformat(), trade_id),
        )
        self.conn.commit()

    def get_daily_exposure(self, agent_id: str) -> float:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        row = self.conn.execute(
            "SELECT COALESCE(SUM(size), 0) FROM trades WHERE agent_id = ? AND date(executed_at) = ? AND status != 'cancelled'",
            (agent_id, today),
        ).fetchone()
        return row[0] if row else 0.0

    def get_daily_pnl(self, agent_id: str) -> float:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        row = self.conn.execute(
            "SELECT COALESCE(SUM(pnl), 0) FROM trades WHERE agent_id = ? AND date(executed_at) = ?",
            (agent_id, today),
        ).fetchone()
        return row[0] if row else 0.0

    def get_recent_trades(self, agent_id: str, hours: int = 24) -> list:
        rows = self.conn.execute(
            "SELECT * FROM trades WHERE agent_id = ? AND executed_at > datetime('now', ?) ORDER BY executed_at DESC",
            (agent_id, f"-{hours} hours"),
        ).fetchall()
        return [dict(row) for row in rows]

    def add_learning(
        self, agent_id: str, category: str, insight: str, pnl_impact: float = 0
    ):
        self.conn.execute(
            "INSERT INTO learnings (agent_id, category, insight, pnl_impact, created_at) VALUES (?, ?, ?, ?, ?)",
            (
                agent_id,
                category,
                insight,
                pnl_impact,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        self.conn.commit()

    def get_learnings(self, category: str, limit: int = 10) -> list:
        rows = self.conn.execute(
            "SELECT * FROM learnings WHERE category = ? ORDER BY created_at DESC LIMIT ?",
            (category, limit),
        ).fetchall()
        return [dict(row) for row in rows]

    def update_agent_state(self, agent_id: str, updates: dict):
        existing = self.conn.execute(
            "SELECT * FROM agent_state WHERE agent_id = ?", (agent_id,)
        ).fetchone()
        if existing:
            sets = ", ".join(f"{k} = ?" for k in updates)
            self.conn.execute(
                f"UPDATE agent_state SET {sets} WHERE agent_id = ?",
                list(updates.values()) + [agent_id],
            )
        else:
            defaults = {
                "agent_id": agent_id,
                "category": "",
                "capital": 0,
                "peak_capital": 0,
                "daily_pnl": 0,
                "daily_trades": 0,
                "total_trades": 0,
                "win_rate": 0,
                "last_scan": None,
                "last_trade": None,
                "status": "active",
            }
            defaults.update(updates)
            cols = ", ".join(defaults.keys())
            placeholders = ", ".join("?" * len(defaults))
            self.conn.execute(
                f"INSERT INTO agent_state ({cols}) VALUES ({placeholders})",
                list(defaults.values()),
            )
        self.conn.commit()

    def get_agent_state(self, agent_id: str) -> dict:
        row = self.conn.execute(
            "SELECT * FROM agent_state WHERE agent_id = ?", (agent_id,)
        ).fetchone()
        return dict(row) if row else {}


# ============================================================================
# Signal Detection
# ============================================================================


def fetch_markets(limit: int = 100) -> list:
    """Fetch Polymarket markets via DNS bypass."""
    url = f"https://{HOST}/markets?limit={limit}"
    try:
        result = subprocess.run(
            [
                "curl",
                "-s",
                "--resolve",
                f"{HOST}:443:{GAMMA_IP}",
                url,
                "-H",
                f"Host: {HOST}",
                "-H",
                "User-Agent: PolyAgent/1.0",
                "--max-time",
                "15",
            ],
            capture_output=True,
            text=True,
            timeout=20,
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            return data if isinstance(data, list) else []
    except Exception:
        pass
    return []


def detect_edge_signals(markets: list, category_filter: str = None) -> list:
    """Detect HIGH edge signals from market data."""
    signals = []
    for m in markets:
        try:
            vol = float(m.get("volume", 0) or 0)
        except (ValueError, TypeError):
            continue
        if vol < 50:
            continue

        prices_raw = m.get("outcomePrices", "[]")
        if isinstance(prices_raw, str):
            try:
                prices_raw = json.loads(prices_raw)
            except:
                continue
        if not isinstance(prices_raw, list) or len(prices_raw) < 2:
            continue
        try:
            yes = float(prices_raw[0])
        except (ValueError, TypeError):
            continue

        dev = abs(yes - 0.50)
        if dev < MIN_EDGE_DEVIATION:
            continue
        if yes < 0.10 or yes > 0.90:
            continue

        question = m.get("question", "")
        cat = categorize(question)
        if category_filter and cat != category_filter:
            continue

        signals.append(
            {
                "market_id": m.get("conditionId", ""),
                "question": question,
                "volume": vol,
                "yes_price": yes,
                "deviation": dev,
                "category": cat,
                "slug": m.get("slug", ""),
            }
        )

    signals.sort(key=lambda s: s["deviation"], reverse=True)
    return signals


CATEGORY_KEYWORDS = {
    "sports": ["relegat", "qualify", "championship", "league", "finish"],
    "geopolitics": [
        "russia",
        "ukraine",
        "iran",
        "china",
        "taiwan",
        "ceasefire",
        "tariff",
    ],
    "tech": ["release", "launch", "gta", "iphone", "feature", "model"],
    "weather": ["temperature", "rain", "snow", "storm", "°"],
}


def categorize(question: str) -> str:
    q = question.lower()
    for cat, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in q:
                return cat
    return "other"


# ============================================================================
# WorldMonitor Intelligence
# ============================================================================

_wm_cache: dict = {"data": None, "ts": 0}


def fetch_wm_intelligence() -> dict:
    """Fetch WorldMonitor risk scores, cross-source signals, and market implications.
    Falls back to direct GDELT queries if WM API is unavailable (auth required)."""
    now = time.time()
    if _wm_cache["data"] and now - _wm_cache["ts"] < WM_CACHE_TTL:
        return _wm_cache["data"]

    result = {
        "risk_scores": [],
        "cross_source_signals": [],
        "market_implications": [],
        "geo_heat": 0.0,
        "geo_sentiment": "calm",
        "relevant_countries": [],
        "market_bias": "neutral",
        "market_bias_drivers": [],
    }

    try:
        headers = {"Accept": "application/json", "User-Agent": "PolyAgent/1.0"}
        timeout = 15

        try:
            risk_resp = requests.get(
                f"{WM_BASE}/api/intelligence/v1/get-risk-scores",
                headers=headers,
                timeout=timeout,
            )
            if risk_resp.ok:
                risk_data = risk_resp.json()
                scores = risk_data.get("ciiScores", [])
                result["risk_scores"] = scores
                high_risk = [s for s in scores if s.get("combinedScore", 0) >= 50]
                if high_risk:
                    result["geo_heat"] = (
                        sum(s["combinedScore"] for s in high_risk)
                        / len(high_risk)
                        / 100
                    )
                    result["relevant_countries"] = list(
                        {s["region"] for s in high_risk}
                    )
        except Exception:
            pass

        try:
            signals_resp = requests.get(
                f"{WM_BASE}/api/intelligence/v1/list-cross-source-signals",
                headers=headers,
                timeout=timeout,
            )
            if signals_resp.ok:
                sig_data = signals_resp.json()
                signals = sig_data.get("signals", [])
                result["cross_source_signals"] = signals
                critical = [
                    s
                    for s in signals
                    if "HIGH" in s.get("severity", "")
                    or "CRITICAL" in s.get("severity", "")
                ]
                if critical:
                    result["relevant_countries"].extend(
                        s.get("theater", "") for s in critical
                    )
                    result["relevant_countries"] = list(
                        set(result["relevant_countries"])
                    )
        except Exception:
            pass

        try:
            mkt_resp = requests.get(
                f"{WM_BASE}/api/intelligence/v1/list-market-implications",
                headers=headers,
                timeout=timeout,
            )
            if mkt_resp.ok:
                mkt_data = mkt_resp.json()
                cards = mkt_data.get("cards", [])
                result["market_implications"] = cards
                bullish = sum(
                    1
                    for c in cards
                    if any(
                        w in c.get("direction", "").lower()
                        for w in ["bullish", "up", "long"]
                    )
                )
                bearish = sum(
                    1
                    for c in cards
                    if any(
                        w in c.get("direction", "").lower()
                        for w in ["bearish", "down", "short"]
                    )
                )
                if bullish + bearish > 0:
                    net = (bullish - bearish) / (bullish + bearish)
                    result["market_bias"] = (
                        "bullish"
                        if net > 0.2
                        else "bearish"
                        if net < -0.2
                        else "neutral"
                    )
                    result["market_bias_drivers"] = [
                        c.get("title", "") for c in cards[:3]
                    ]
        except Exception:
            pass

    except Exception as e:
        print(f"  ⚠ WorldMonitor fetch failed: {e}", file=sys.stderr)

    if not result["risk_scores"] and not result["cross_source_signals"]:
        print(
            f"  ⚠ WM API unavailable — using direct GDELT enrichment", file=sys.stderr
        )
        result = _fetch_gdelt_fallback(result)

    geo_score = result["geo_heat"]
    result["geo_sentiment"] = (
        "critical"
        if geo_score >= 0.8
        else "elevated"
        if geo_score >= 0.6
        else "moderate"
        if geo_score >= 0.4
        else "calm"
    )

    _wm_cache["data"] = result
    _wm_cache["ts"] = now
    return result


def _fetch_gdelt_fallback(result: dict) -> dict:
    """Fallback: query GDELT API directly for geopolitical sentiment."""
    try:
        queries = [
            ("(military OR airstrike OR naval) sourcelang:eng", "conflict"),
            ("(sanctions OR embargo OR tariff) sourcelang:eng", "economic"),
            ("(cyberattack OR ransomware) sourcelang:eng", "cyber"),
        ]
        for query, category in queries:
            try:
                url = f"https://api.gdeltproject.org/api/v2/doc/doc?query={url_quote(query)}&mode=artlist&maxrecords=5&format=json&timespan=7d"
                resp = requests.get(
                    url, timeout=10, headers={"User-Agent": "PolyAgent/1.0"}
                )
                if not resp.ok or not resp.text.strip():
                    continue
                data = resp.json()
                articles = data.get("articles", [])
                for art in articles[:3]:
                    title = art.get("title", "")
                    tone = 0.0
                    try:
                        tone = float(art.get("tone", "0").split(",")[0])
                    except (ValueError, IndexError):
                        pass
                    result["cross_source_signals"].append(
                        {
                            "id": f"gdelt_{category}",
                            "type": category,
                            "theater": "Global",
                            "summary": title[:100],
                            "severity": "CRITICAL"
                            if tone < -5
                            else "HIGH"
                            if tone < -2
                            else "MEDIUM",
                            "severityScore": abs(tone),
                            "detectedAt": int(time.time() * 1000),
                            "contributingTypes": [category],
                            "signalCount": len(articles),
                        }
                    )
                if len(articles) > 3:
                    result["geo_heat"] = min(1.0, result["geo_heat"] + 0.1)
                time.sleep(6)
            except Exception:
                continue
    except Exception as e:
        print(f"  ⚠ GDELT fallback failed: {e}", file=sys.stderr)
    return result


def enrich_signal_with_intel(signal: dict, wm_intel: dict) -> dict:
    """Enrich a market signal with WorldMonitor geopolitical intelligence."""
    question = signal.get("question", "").lower()

    country_boost = 0.0
    for country in wm_intel.get("relevant_countries", []):
        if country.lower() in question:
            for rs in wm_intel.get("risk_scores", []):
                if rs.get("region") == country:
                    country_boost = max(country_boost, rs.get("combinedScore", 0) / 200)
                    break

    geo_boost = wm_intel.get("geo_heat", 0) * 0.1

    bias = wm_intel.get("market_bias", "neutral")
    bias_adj = 0.02 if bias == "bullish" else -0.02 if bias == "bearish" else 0.0

    signal["wm_geo_sentiment"] = wm_intel.get("geo_sentiment", "unknown")
    signal["wm_country_risk"] = country_boost
    signal["wm_geo_boost"] = geo_boost
    signal["wm_bias"] = bias
    signal["wm_enriched"] = True

    signal["deviation"] = min(
        0.50, signal["deviation"] + country_boost + geo_boost + bias_adj
    )

    return signal


# ============================================================================
# Risk Check
# ============================================================================


def risk_check(
    signal: dict, brain: SwarmBrain, agent_id: str
) -> tuple[bool, str, float]:
    """Run pre-trade risk checks. Returns (allowed, reason, adjusted_size)."""
    reasons = []
    size = min(MAX_POSITION_USDC, signal["volume"] * 0.01)  # 1% of market volume

    # Daily exposure
    daily_exposure = brain.get_daily_exposure(agent_id)
    if daily_exposure + size > MAX_DAILY_RISK:
        reasons.append(
            f"Daily exposure ${daily_exposure:.0f} + ${size:.0f} > ${MAX_DAILY_RISK}"
        )

    # Daily loss
    daily_pnl = brain.get_daily_pnl(agent_id)
    if daily_pnl < -20:
        reasons.append(f"Daily loss ${abs(daily_pnl):.0f} exceeds limit")

    # Duplicate check
    recent = brain.get_recent_trades(agent_id, hours=6)
    for trade in recent:
        if trade["market_id"] == signal["market_id"]:
            reasons.append(f"Already traded this market in last 6h")

    # Confidence floor
    confidence = signal["deviation"] * 100  # crude proxy
    if confidence < MIN_CONFIDENCE:
        reasons.append(f"Confidence {confidence:.0f}% below {MIN_CONFIDENCE}%")

    if reasons:
        return False, "; ".join(reasons), 0

    return True, "ok", size


# ============================================================================
# Telegram
# ============================================================================


def send_telegram(text: str) -> bool:
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return False
    try:
        resp = requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
            data={"chat_id": TELEGRAM_CHAT_ID, "text": text, "parse_mode": "HTML"},
            timeout=10,
        )
        return resp.json().get("ok", False)
    except Exception:
        return False


# ============================================================================
# Swarm Agent
# ============================================================================


class SwarmAgent:
    """Self-learning trading agent. Reads signals → trades → learns."""

    def __init__(self, agent_id: str, category: str, private_key: str):
        self.agent_id = agent_id
        self.category = category
        self.brain = SwarmBrain()
        self.executor = TradeExecutor(private_key) if private_key else None

    def run_cycle(self):
        """Single decision cycle: scan → enrich with WM intel → decide → execute → learn."""
        print(
            f"\n◆ {self.agent_id} — cycle start {datetime.now().strftime('%H:%M:%S')}",
            file=sys.stderr,
        )

        # 1. Scan for signals
        markets = fetch_markets(100)
        signals = detect_edge_signals(markets, self.category)
        print(f"  {len(signals)} raw edge signals in {self.category}", file=sys.stderr)

        if not signals:
            self._log_learning("No edge signals found — market is efficient")
            return

        # 2. Enrich with WorldMonitor intelligence
        wm_intel = fetch_wm_intelligence()
        enriched = [enrich_signal_with_intel(s, wm_intel) for s in signals]
        enriched.sort(key=lambda s: s["deviation"], reverse=True)

        geo_label = wm_intel.get("geo_sentiment", "unknown")
        bias_label = wm_intel.get("market_bias", "neutral")
        print(
            f"  WM intel: geo={geo_label} bias={bias_label} countries={wm_intel.get('relevant_countries', [])[:5]}",
            file=sys.stderr,
        )

        # 3. Load past learnings for context
        learnings = self.brain.get_learnings(self.category, limit=5)
        learning_context = (
            "; ".join([l["insight"] for l in learnings]) if learnings else "none"
        )

        # 4. For top signal: risk check → execute
        top = enriched[0]
        allowed, reason, size = risk_check(top, self.brain, self.agent_id)

        if not allowed:
            print(f"  ✗ Blocked: {reason}", file=sys.stderr)
            return

        # 4. Execute trade
        outcome = (
            "NO" if top["yes_price"] > 0.50 else "YES"
        )  # fade the consensus on obscure
        trade_id = hashlib.md5(
            f"{self.agent_id}{top['market_id']}{time.time()}".encode()
        ).hexdigest()[:16]

        print(
            f"  ▶ {outcome} on {top['question'][:60]} at {top['yes_price']:.3f} for ${size:.2f}",
            file=sys.stderr,
        )

        result = {"success": False, "error": "dry run — no private key"}
        if self.executor:
            result = self.executor.place_order(
                top["market_id"], outcome, top["yes_price"], size
            )

        # 5. Log trade
        trade = {
            "id": trade_id,
            "agent_id": self.agent_id,
            "category": self.category,
            "market_id": top["market_id"],
            "question": top["question"][:120],
            "outcome": outcome,
            "price": top["yes_price"],
            "size": size,
            "tx_hash": result.get("tx_hash"),
            "status": "filled" if result.get("success") else "failed",
            "edge_deviation": top["deviation"],
            "confidence": top["deviation"] * 100,
            "notes": f"signal_dev={top['deviation']:.2f} vol=${top['volume']:.0f} wm_geo={top.get('wm_geo_sentiment', 'n/a')} wm_bias={top.get('wm_bias', 'n/a')} {reason}",
        }
        self.brain.log_trade(trade)

        # 6. Update agent state
        self.brain.update_agent_state(
            self.agent_id,
            {
                "last_trade": datetime.now(timezone.utc).isoformat(),
                "daily_trades": self.brain.get_daily_exposure(self.agent_id)
                / max(size, 1),
            },
        )

        # 7. Telegram confirmation
        if result.get("success"):
            send_telegram(
                f"🤖 <b>PolyAgent Trade</b> [{self.category}]\n"
                f"{outcome} {top['yes_price']:.3f} × ${size:.2f}\n"
                f"<b>{top['question'][:80]}</b>\n"
                f"TX: <code>{result['tx_hash'][:16]}...</code>"
            )
            self._log_learning(
                f"EXECUTED {outcome} on {top['question'][:40]} — monitoring outcome"
            )
        else:
            print(f"  ✗ Failed: {result.get('error', 'unknown')}", file=sys.stderr)

    def _log_learning(self, insight: str):
        self.brain.add_learning(self.agent_id, self.category, insight)

    def run_loop(self):
        """Continuous scan → trade loop."""
        print(
            f"◆ PolyAgent {self.agent_id} [{self.category}] starting...",
            file=sys.stderr,
        )
        balance = self.executor.get_balance() if self.executor else 0
        print(
            f"  Wallet: {self.executor.address if self.executor else 'N/A'} | Balance: ${balance:.2f}",
            file=sys.stderr,
        )

        while True:
            try:
                self.run_cycle()
            except Exception as e:
                print(f"  ✗ Cycle error: {e}", file=sys.stderr)
                self._log_learning(f"ERROR: {str(e)[:100]}")

            print(f"  Sleeping {SCAN_INTERVAL}s...", file=sys.stderr)
            time.sleep(SCAN_INTERVAL)


# ============================================================================
# CLI
# ============================================================================


def main():
    import argparse

    parser = argparse.ArgumentParser(description="PolyAgent Swarm Trading Agent")
    parser.add_argument(
        "--category", default=None, help="Market category to specialize in"
    )
    parser.add_argument("--agent-id", default=None, help="Unique agent identifier")
    parser.add_argument("--once", action="store_true", help="Single cycle, then exit")
    parser.add_argument("--private-key", default=None, help="Wallet private key")
    args = parser.parse_args()

    # Auto-detect category from env or arg
    category = args.category or os.environ.get("STEALTH_CATEGORY", "sports")
    agent_id = (
        args.agent_id
        or f"polyagent_{category}_{hashlib.md5(category.encode()).hexdigest()[:6]}"
    )

    private_key = args.private_key or os.environ.get("POLYMARKET_PRIVATE_KEY", "")
    if not private_key:
        print(
            "⚠ POLYMARKET_PRIVATE_KEY not set — trading in dry-run mode",
            file=sys.stderr,
        )
        print(
            "  Set env var or pass --private-key to execute real trades",
            file=sys.stderr,
        )

    agent = SwarmAgent(agent_id, category, private_key)

    if args.once:
        agent.run_cycle()
    else:
        agent.run_loop()


if __name__ == "__main__":
    main()
