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
except ImportError:
    print("ERROR: pip install requests")
    sys.exit(1)

# Import our modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from trade_executor import TradeExecutor

# ============================================================================
# Config
# ============================================================================

BRAIN_DB = Path(os.environ.get("BRAIN_DB_PATH", "/app/data/swarm_brain.db"))
SIGNAL_DB = Path(os.environ.get("SIGNAL_DB_PATH", "/app/data/signals.db"))
SCAN_INTERVAL = 900
MAX_POSITION_USDC = 3.50
MAX_DAILY_RISK_PCT = 0.15
MAX_TRADES_PER_CYCLE = 2
MAX_OPEN_PER_CATEGORY = 2
DUPLICATE_HOURS_EDGE = 8
DUPLICATE_HOURS_STEALTH = 4
MIN_MARKET_VOLUME = 5000
MIN_TIME_TO_RESOLUTION_HOURS = 6
PAPER_TRADE = os.environ.get("PAPER_TRADE", "1") == "1"
STEALTH_MIN_WALLET_SCORE = 60
STEALTH_MIN_WIN_RATE = 0.60
VALUE_NO_MAX_PRICE = 0.18
VALUE_YES_MIN_PROB = 0.75
VALUE_YES_MAX_PROB = 0.92
BANKROLL_RISK_PCT = 0.05

GAMMA_IP = "104.18.34.205"
HOST = "gamma-api.polymarket.com"

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
        self.conn.row_factory = sqlite3.Row
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
# Stealth Copy Signals (reads from StealthTrace v3 shared DB)
# ============================================================================

STEALTH_DB = Path(os.environ.get("STEALTH_DB_PATH", "/app/data/watched_wallets.db"))


def fetch_stealth_copy_signals(category_filter: str = None) -> list:
    """Read watched wallets' positions. Wallet score IS the edge signal."""
    if not STEALTH_DB.exists():
        return []

    signals = []
    seen = set()
    try:
        conn = sqlite3.connect(str(STEALTH_DB), timeout=5)
        conn.row_factory = sqlite3.Row

        wallets = conn.execute(
            "SELECT * FROM watched_wallets WHERE active = 1 AND blacklisted = 0 "
            "AND copy_action IN ('AUTO_WATCH', 'MONITOR_FUNDING') AND score >= ? "
            "AND obscure_win_rate >= ? "
            "ORDER BY score DESC LIMIT 10",
            (STEALTH_MIN_WALLET_SCORE, STEALTH_MIN_WIN_RATE),
        ).fetchall()

        for w in wallets:
            positions = conn.execute(
                "SELECT * FROM wallet_positions WHERE wallet_address = ? "
                "ORDER BY first_seen_at DESC LIMIT 10",
                (w["address"],),
            ).fetchall()

            for p in positions:
                cid = p["condition_id"] or ""
                if cid in seen:
                    continue
                seen.add(cid)

                q = p["question"] or ""
                cat = categorize(q)
                if category_filter and cat != category_filter:
                    continue

                price = p["price"] or 0.5
                if price < 0.10 or price > 0.95:
                    continue

                size_pct = w["suggested_size_pct"] or 1.0
                our_size = min(MAX_POSITION_USDC, 3.50 * size_pct)

                outcome = p["outcome"] or "YES"
                yes_p = price if outcome == "YES" else (1.0 - price)
                no_p = 1.0 - yes_p

                signals.append(
                    {
                        "market_id": cid,
                        "question": q,
                        "volume": p["market_volume"] or 0,
                        "yes_price": yes_p,
                        "no_price": no_p,
                        "deviation": abs(yes_p - 0.50),
                        "best_side": outcome,
                        "best_price": price if outcome == "YES" else no_p,
                        "edge_score": w["score"] * 1.5,
                        "category": cat,
                        "slug": "",
                        "source": f"stealth_copy:{w['address'][:10]}:{w['score']}pts",
                        "copy_size": our_size,
                        "is_stealth": True,
                        "wallet_score": w["score"],
                        "wallet_win_rate": w["obscure_win_rate"] or 0,
                        "signal_type": "stealth_copy",
                    }
                )

        conn.close()
    except Exception:
        pass

    signals.sort(key=lambda s: s.get("wallet_score", 0), reverse=True)
    return signals


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
    """Value-betting signal detection. Two strategies:
    1. BUY NO on overvalued favorites (YES > 0.82, NO price < VALUE_NO_MAX_PRICE)
       - If the market resolves NO, we win ~85-90% on our bet
       - Even a small mispricing gives large asymmetric payoff
    2. BUY YES on strong favorites in the sweet spot (0.75-0.92)
       - High win rate, small per-trade profit, compounds over many trades
    """
    signals = []
    for m in markets:
        try:
            vol = float(m.get("volume", 0) or 0)
        except (ValueError, TypeError):
            continue
        if vol < MIN_MARKET_VOLUME:
            continue

        end_date = m.get("endDate") or m.get("endDateIso", "")
        if end_date:
            try:
                if isinstance(end_date, str):
                    end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                    hours_left = (
                        end_dt - datetime.now(timezone.utc)
                    ).total_seconds() / 3600
                    if hours_left < MIN_TIME_TO_RESOLUTION_HOURS:
                        continue
            except (ValueError, TypeError):
                pass

        prices_raw = m.get("outcomePrices", "[]")
        if isinstance(prices_raw, str):
            try:
                prices_raw = json.loads(prices_raw)
            except Exception:
                continue
        if not isinstance(prices_raw, list) or len(prices_raw) < 2:
            continue
        try:
            yes = float(prices_raw[0])
            no = float(prices_raw[1])
        except (ValueError, TypeError):
            continue

        if yes < 0.05 or yes > 0.97:
            continue

        question = m.get("question", "")
        cat = categorize(question)
        if category_filter and cat != category_filter:
            continue

        cid = m.get("conditionId", "")

        if yes >= 0.82 and no <= VALUE_NO_MAX_PRICE:
            payout_if_correct = 1.0 / no if no > 0 else 0
            edge_score = (yes - 0.75) * 100 * payout_if_correct
            signals.append(
                {
                    "market_id": cid,
                    "question": question,
                    "volume": vol,
                    "yes_price": yes,
                    "no_price": no,
                    "deviation": abs(yes - 0.50),
                    "best_side": "NO",
                    "best_price": no,
                    "edge_score": edge_score,
                    "category": cat,
                    "slug": m.get("slug", ""),
                    "signal_type": "value_no",
                    "is_stealth": False,
                }
            )

        elif VALUE_YES_MIN_PROB <= yes <= VALUE_YES_MAX_PROB:
            implied_edge = yes - 0.50
            edge_score = implied_edge * 80
            signals.append(
                {
                    "market_id": cid,
                    "question": question,
                    "volume": vol,
                    "yes_price": yes,
                    "no_price": no,
                    "deviation": abs(yes - 0.50),
                    "best_side": "YES",
                    "best_price": yes,
                    "edge_score": edge_score,
                    "category": cat,
                    "slug": m.get("slug", ""),
                    "signal_type": "value_yes",
                    "is_stealth": False,
                }
            )

    signals.sort(key=lambda s: s["edge_score"], reverse=True)
    return signals


CATEGORY_KEYWORDS = {
    "sports": [
        "nba",
        "nhl",
        "nfl",
        "mlb",
        "premier league",
        "la liga",
        "serie a",
        "bundesliga",
        "champions league",
        "world cup",
        "stanley cup",
        "super bowl",
        "playoffs",
        "finals",
        "title",
        "championship",
        "tournament",
        "relegat",
        "qualify",
        "league",
        "finish",
        "grand slam",
        "ufc",
        "boxing",
        "tennis",
        "golf",
        "masters",
        "fighter",
        "cup final",
        "cup winner",
        "cup champion",
    ],
    "geopolitics": [
        "russia",
        "ukraine",
        "iran",
        "china",
        "taiwan",
        "ceasefire",
        "tariff",
        "president",
        "election",
        "senator",
        "governor",
        "democratic",
        "republican",
        "congress",
        "senate",
        "vote",
        "nomination",
        "primary",
        "impeach",
        "war",
        "military",
        "nato",
        "sanctions",
        "treaty",
        "diplomat",
        "security council",
        "united nations",
        "eu ",
        "brexit",
        "border",
    ],
    "tech": [
        "release",
        "launch",
        "gta",
        "iphone",
        "feature",
        "model",
        "ai ",
        "artificial intelligence",
        "chatgpt",
        "openai",
        "google",
        "apple",
        "microsoft",
        "tesla",
        "spacex",
        "starship",
        "mars",
        "moon",
        "bitcoin",
        "ethereum",
        "crypto",
        "blockchain",
        "nft",
        "android",
        "ios",
        "macos",
        "windows",
        "chip",
        "gpu",
        "rocket",
        "satellite",
        "falcon",
        "starlink",
    ],
    "weather": [
        "temperature",
        "rain",
        "snow",
        "storm",
        "°",
        "hurricane",
        "cyclone",
        "typhoon",
        "tornado",
        "earthquake",
        "flood",
        "drought",
        "wildfire",
        "heatwave",
        "cold",
        "weather",
        "climate",
        "celsius",
        "fahrenheit",
        "precipitation",
    ],
}


def categorize(question: str) -> str:
    q = question.lower()
    for cat, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in q:
                return cat
    return "other"


# ============================================================================
# Risk Check
# ============================================================================


def risk_check(
    signal: dict,
    brain: SwarmBrain,
    agent_id: str,
    balance: float,
    is_stealth: bool = False,
) -> tuple[bool, str, float]:
    """Conservative risk check. Returns (allowed, reason, adjusted_size)."""
    reasons = []

    best_price = signal.get("best_price", signal.get("yes_price", 0.5))
    if best_price <= 0.05 or best_price >= 0.98:
        return False, f"price {best_price:.3f} out of safe range", 0

    max_bet = balance * BANKROLL_RISK_PCT
    base_size = min(MAX_POSITION_USDC, max_bet)

    if is_stealth:
        wallet_score = signal.get("wallet_score", 50)
        win_rate = signal.get("wallet_win_rate", 0.60)
        conviction_mult = 0.5 + (wallet_score / 100) * 0.5
        base_size = min(MAX_POSITION_USDC, max_bet * conviction_mult)

    size = max(2.0, base_size)

    daily_exposure = brain.get_daily_exposure(agent_id)
    max_daily = balance * MAX_DAILY_RISK_PCT
    remaining_daily = max_daily - daily_exposure
    if remaining_daily < 2.0:
        reasons.append(f"daily exposure ${daily_exposure:.1f} at {max_daily:.1f} cap")
    elif remaining_daily < size:
        size = remaining_daily

    recent = brain.get_recent_trades(agent_id, hours=24)
    open_cats = {}
    for t in recent:
        if t["status"] in ("pending", "filled"):
            c = t.get("category", "other")
            open_cats[c] = open_cats.get(c, 0) + 1
    signal_cat = signal.get("category", "other")
    if open_cats.get(signal_cat, 0) >= MAX_OPEN_PER_CATEGORY:
        reasons.append(
            f"{signal_cat}: {open_cats[signal_cat]} positions (max {MAX_OPEN_PER_CATEGORY})"
        )

    dup_hours = DUPLICATE_HOURS_STEALTH if is_stealth else DUPLICATE_HOURS_EDGE
    for t in recent:
        if t["market_id"] == signal["market_id"]:
            hours_ago = (
                datetime.now(timezone.utc) - datetime.fromisoformat(t["executed_at"])
            ).total_seconds() / 3600
            if hours_ago < dup_hours:
                reasons.append(
                    f"traded this market {hours_ago:.0f}h ago (< {dup_hours}h cooldown)"
                )
                break

    daily_pnl = brain.get_daily_pnl(agent_id)
    if daily_pnl < -(balance * 0.10):
        reasons.append(f"daily loss ${abs(daily_pnl):.1f} exceeds 10% of balance")

    if not is_stealth:
        sig_type = signal.get("signal_type", "")
        if sig_type == "value_no" and best_price > VALUE_NO_MAX_PRICE:
            reasons.append(f"NO price {best_price:.3f} above cap {VALUE_NO_MAX_PRICE}")
        elif sig_type == "value_yes" and (
            best_price < VALUE_YES_MIN_PROB or best_price > VALUE_YES_MAX_PROB
        ):
            reasons.append(f"YES price {best_price:.3f} outside value range")

    if reasons:
        return False, "; ".join(reasons), 0

    return True, "ok", round(size, 2)


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
        """Single decision cycle: scan → rank → execute top N → learn."""
        mode = "PAPER" if PAPER_TRADE else "LIVE"
        print(
            f"\n◆ {self.agent_id} [{mode}] — cycle start {datetime.now().strftime('%H:%M:%S')}",
            file=sys.stderr,
        )

        if self.executor:
            balance = self.executor.get_balance()
            if balance < 3.0:
                print(
                    f"  ⏸ Balance too low (${balance:.2f}) — skipping", file=sys.stderr
                )
                return
            self._available_balance = balance
        else:
            self._available_balance = 70.0

        markets = fetch_markets(200)
        edge_signals = detect_edge_signals(markets, self.category)

        stealth_signals = fetch_stealth_copy_signals(self.category)
        if stealth_signals:
            print(f"  {len(stealth_signals)} stealth copy signals", file=sys.stderr)

        all_signals = []
        seen_ids = set()
        market_lookup = {
            m.get("conditionId", ""): m for m in markets if m.get("conditionId")
        }
        for s in stealth_signals:
            cid = s["market_id"]
            if cid not in seen_ids:
                all_signals.append(s)
                seen_ids.add(cid)
        for s in edge_signals:
            if s["market_id"] not in seen_ids:
                all_signals.append(s)
                seen_ids.add(s["market_id"])

        all_signals.sort(
            key=lambda s: (
                1 if s.get("is_stealth") else 0,
                s.get("edge_score", 0),
            ),
            reverse=True,
        )

        no_counts = {"value_no": 0, "value_yes": 0, "stealth_copy": 0}
        for s in all_signals:
            st = s.get("signal_type", "edge")
            no_counts[st] = no_counts.get(st, 0) + 1

        parts = [f"{k}:{v}" for k, v in no_counts.items() if v > 0]
        print(
            f"  {len(all_signals)} signals ({', '.join(parts)}) in {self.category}",
            file=sys.stderr,
        )

        if not all_signals:
            self._log_learning("No signals found")
            return

        executed = 0
        for signal in all_signals:
            if executed >= MAX_TRADES_PER_CYCLE:
                break

            is_stealth = signal.get("is_stealth", False)
            allowed, reason, size = risk_check(
                signal,
                self.brain,
                self.agent_id,
                self._available_balance,
                is_stealth=is_stealth,
            )

            if not allowed:
                print(
                    f"  ✗ {signal['question'][:45]}... Blocked: {reason}",
                    file=sys.stderr,
                )
                continue

            size = min(size, self._available_balance * 0.95)
            if size < 2.0:
                print(
                    f"  ⏸ Remaining balance ${self._available_balance:.2f} too low",
                    file=sys.stderr,
                )
                break

            outcome = signal.get("best_side", "YES")
            trade_size = signal.get("copy_size", size) if is_stealth else size
            trade_size = min(trade_size, size)

            trade_id = hashlib.md5(
                f"{self.agent_id}{signal['market_id']}{time.time()}".encode()
            ).hexdigest()[:16]

            src_tag = f" [{signal.get('source', signal.get('signal_type', ''))}]"
            price_label = signal.get("best_price", signal.get("yes_price", 0))
            sig_type = signal.get("signal_type", "edge")

            print(
                f"  {'📝' if PAPER_TRADE else '▶'} {outcome} on {signal['question'][:55]} "
                f"at {price_label:.3f} for ${trade_size:.2f}{src_tag}",
                file=sys.stderr,
            )

            result = {
                "success": False,
                "error": "paper trade" if PAPER_TRADE else "no executor",
            }
            if not PAPER_TRADE and self.executor:
                result = self.executor.place_order(
                    signal["market_id"],
                    outcome,
                    signal.get("yes_price", 0.5),
                    trade_size,
                )

            trade = {
                "id": trade_id,
                "agent_id": self.agent_id,
                "category": self.category,
                "market_id": signal["market_id"],
                "question": signal["question"][:120],
                "outcome": outcome,
                "price": price_label,
                "size": trade_size,
                "tx_hash": result.get("tx_hash"),
                "status": ("paper" if PAPER_TRADE else "filled")
                if result.get("success")
                else "failed",
                "edge_deviation": signal["deviation"],
                "confidence": signal.get("edge_score", 0),
                "notes": f"{sig_type} {'stealth' if is_stealth else 'value'} dev={signal['deviation']:.2f} vol=${signal['volume']:.0f}",
            }
            self.brain.log_trade(trade)

            self.brain.update_agent_state(
                self.agent_id,
                {
                    "last_trade": datetime.now(timezone.utc).isoformat(),
                },
            )

            if result.get("success") or PAPER_TRADE:
                self._available_balance -= trade_size
                mode_label = "📝 PAPER" if PAPER_TRADE else "🤖 LIVE"
                send_telegram(
                    f"{mode_label} <b>PolyAgent</b> [{self.category}]\n"
                    f"{outcome} {price_label:.3f} × ${trade_size:.2f}\n"
                    f"<b>{signal['question'][:80]}</b>\n"
                    f"🔍 {sig_type} | wallet={signal.get('wallet_score', 'N/A')} | bal=${self._available_balance:.2f}"
                )
                self._log_learning(
                    f"{'PAPER ' if PAPER_TRADE else ''}{sig_type} {outcome} on {signal['question'][:40]}"
                )
                executed += 1
            else:
                print(f"  ✗ Failed: {result.get('error', 'unknown')}", file=sys.stderr)

        if executed == 0:
            print(f"  → No trades this cycle", file=sys.stderr)

    def _log_learning(self, insight: str):
        self.brain.add_learning(self.agent_id, self.category, insight)

    def run_loop(self):
        """Continuous scan → trade loop."""
        mode = "PAPER-TRADE (dry run)" if PAPER_TRADE else "LIVE TRADING"
        print(
            f"◆ PolyAgent {self.agent_id} [{self.category}] starting — {mode}",
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
