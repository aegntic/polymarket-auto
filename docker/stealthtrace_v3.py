#!/usr/bin/env python3
"""
StealthTrace v3 — Autonomous Obscure Edge Hunter
=================================================
Runs continuously: auto-discovers seeds, traces funding, scores wallets
via LAYER 1-5, feeds candidates through Grok for deep analysis, writes
watched wallets to shared DB for swarm agents to copy-trade.

NO changes to existing trading pipeline. Additive only.

Usage:
    python3 stealthtrace_v3.py                    # continuous loop, every 4h
    python3 stealthtrace_v3.py --once             # single scan
    python3 stealthtrace_v3.py --interval 7200    # custom interval (seconds)

Env vars:
    XAI_API_KEY          — xAI Grok API key
    POLYGONSCAN_API_KEY  — Polygonscan API key
    TELEGRAM_BOT_TOKEN   — for daily digest
    TELEGRAM_CHAT_ID     — for daily digest
    STEALTH_DB_PATH      — path to shared watched_wallets.db (default: /app/data/watched_wallets.db)
"""

from __future__ import annotations

import json
import os
import sys
import time
import sqlite3
import hashlib
import argparse
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict

try:
    import requests
    import urllib3

    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
except ImportError:
    print("ERROR: pip install requests urllib3")
    sys.exit(1)

# ============================================================================
# Configuration
# ============================================================================

GAMMA_IP = os.environ.get("POLYMARKET_GAMMA_IP", "104.18.34.205")
GAMMA_HOST = "gamma-api.polymarket.com"
DATA_HOST = "data-api.polymarket.com"

POLYGONSCAN_API = "https://api.etherscan.io/v2/api"
POLYGONSCAN_KEY = os.environ.get("POLYGONSCAN_API_KEY", "")
POLYGON_CHAIN_ID = "137"

USDC_POLYGON = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
USDC_NATIVE = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"

XAI_API_KEY = os.environ.get("XAI_API_KEY", "")
XAI_API_URL = "https://api.x.ai/v1/chat/completions"
XAI_MODEL = os.environ.get("XAI_MODEL", "grok-4.20")

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")

DB_PATH = os.environ.get("STEALTH_DB_PATH", "/app/data/watched_wallets.db")
SCAN_INTERVAL = int(os.environ.get("SCAN_INTERVAL", "14400"))

# Detection thresholds
OBSCURE_VOLUME_MAX = 100_000
STEALTH_WALLET_MAX_AGE_DAYS = 60
MIN_FUNDING_USDC = 300
MIN_OBSCURE_WIN_RATE = 0.65
MIN_SCORE_TO_WATCH = 50
MIN_SCORE_TO_AUTO = 72

# Rate limiting
POLYGONSCAN_DELAY = 0.25 if POLYGONSCAN_KEY else 1.2
MAX_SEEDS_PER_SCAN = 30
MAX_CANDIDATES_PER_SCAN = 30


# ============================================================================
# Shared DB (read by swarm agents via same volume)
# ============================================================================


class WatchedWalletDB:
    """Shared SQLite DB on Docker volume. Written by hunter, read by agents."""

    def __init__(self, path: str = DB_PATH):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(path)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self):
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS watched_wallets (
                address TEXT PRIMARY KEY,
                tier TEXT,
                score INTEGER,
                primary_edge TEXT,
                funding_source TEXT,
                funding_label TEXT,
                obscure_win_rate REAL,
                stealth_level TEXT,
                copy_action TEXT,
                suggested_size_pct REAL,
                confidence TEXT,
                behavioral_read TEXT,
                edge_type TEXT,
                red_flags TEXT,
                grok_raw TEXT,
                discovered_at TEXT,
                last_active_at TEXT,
                last_funding_check TEXT,
                total_pnl_estimate REAL,
                active INTEGER DEFAULT 1,
                blacklisted INTEGER DEFAULT 0,
                blacklist_reason TEXT
            );
            CREATE TABLE IF NOT EXISTS seed_wallets (
                address TEXT PRIMARY KEY,
                source TEXT,
                discovered_at TEXT,
                last_scanned TEXT,
                active INTEGER DEFAULT 1
            );
            CREATE TABLE IF NOT EXISTS wallet_positions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                wallet_address TEXT,
                condition_id TEXT,
                question TEXT,
                outcome TEXT,
                size_usdc REAL,
                price REAL,
                first_seen_at TEXT,
                market_volume REAL,
                UNIQUE(wallet_address, condition_id),
                FOREIGN KEY (wallet_address) REFERENCES watched_wallets(address)
            );
            CREATE TABLE IF NOT EXISTS scan_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scan_time TEXT,
                seeds_scanned INTEGER,
                candidates_found INTEGER,
                wallets_promoted INTEGER,
                wallets_blacklisted INTEGER,
                notes TEXT
            );
        """)
        self.conn.commit()

    def upsert_wallet(self, w: dict):
        self.conn.execute(
            """
            INSERT INTO watched_wallets (address, tier, score, primary_edge, funding_source,
                funding_label, obscure_win_rate, stealth_level, copy_action, suggested_size_pct,
                confidence, behavioral_read, edge_type, red_flags, grok_raw, discovered_at, last_active_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(address) DO UPDATE SET
                tier=excluded.tier, score=excluded.score, primary_edge=excluded.primary_edge,
                funding_source=excluded.funding_source, funding_label=excluded.funding_label,
                obscure_win_rate=excluded.obscure_win_rate, stealth_level=excluded.stealth_level,
                copy_action=excluded.copy_action, suggested_size_pct=excluded.suggested_size_pct,
                confidence=excluded.confidence, behavioral_read=excluded.behavioral_read,
                edge_type=excluded.edge_type, red_flags=excluded.red_flags, grok_raw=excluded.grok_raw,
                last_active_at=excluded.last_active_at
        """,
            (
                w["address"],
                w.get("tier"),
                w.get("score"),
                w.get("primary_edge"),
                w.get("funding_source"),
                w.get("funding_label"),
                w.get("obscure_win_rate", 0),
                w.get("stealth_level"),
                w.get("copy_action"),
                w.get("suggested_size_pct", 1.5),
                w.get("confidence"),
                w.get("behavioral_read"),
                w.get("edge_type"),
                json.dumps(w.get("red_flags", [])),
                json.dumps(w.get("grok_raw", {})),
                w.get("discovered_at", datetime.now(timezone.utc).isoformat()),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        self.conn.commit()

    def add_seed(self, address: str, source: str):
        self.conn.execute(
            """
            INSERT OR IGNORE INTO seed_wallets (address, source, discovered_at)
            VALUES (?, ?, ?)
        """,
            (address.lower(), source, datetime.now(timezone.utc).isoformat()),
        )
        self.conn.commit()

    def get_active_seeds(self) -> List[str]:
        rows = self.conn.execute(
            "SELECT address FROM seed_wallets WHERE active = 1"
        ).fetchall()
        return [r["address"] for r in rows]

    def log_scan(
        self,
        seeds_scanned: int,
        candidates: int,
        promoted: int,
        blacklisted: int,
        notes: str = "",
    ):
        self.conn.execute(
            """
            INSERT INTO scan_log (scan_time, seeds_scanned, candidates_found,
                wallets_promoted, wallets_blacklisted, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        """,
            (
                datetime.now(timezone.utc).isoformat(),
                seeds_scanned,
                candidates,
                promoted,
                blacklisted,
                notes,
            ),
        )
        self.conn.commit()

    def get_watchable(self, min_score: int = MIN_SCORE_TO_WATCH) -> List[dict]:
        rows = self.conn.execute(
            """
            SELECT * FROM watched_wallets
            WHERE active = 1 AND blacklisted = 0 AND score >= ?
            ORDER BY score DESC
        """,
            (min_score,),
        ).fetchall()
        return [dict(r) for r in rows]

    def blacklist(self, address: str, reason: str):
        self.conn.execute(
            "UPDATE watched_wallets SET blacklisted = 1, blacklist_reason = ? WHERE address = ?",
            (reason, address),
        )
        self.conn.commit()

    def upsert_position(self, wallet_address: str, pos: dict):
        self.conn.execute(
            """
            INSERT INTO wallet_positions (wallet_address, condition_id, question, outcome,
                size_usdc, price, first_seen_at, market_volume)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(wallet_address, condition_id) DO UPDATE SET
                size_usdc=excluded.size_usdc, price=excluded.price,
                market_volume=excluded.market_volume, question=excluded.question
        """,
            (
                wallet_address,
                pos.get("condition_id", ""),
                pos.get("question", ""),
                pos.get("outcome", ""),
                pos.get("size_usdc", 0),
                pos.get("price", 0.5),
                datetime.now(timezone.utc).isoformat(),
                pos.get("market_volume", 0),
            ),
        )
        self.conn.commit()

    def clear_stale_positions(self, max_age_hours: int = 48):
        cutoff = (
            datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
        ).isoformat()
        self.conn.execute(
            "DELETE FROM wallet_positions WHERE first_seen_at < ?", (cutoff,)
        )
        self.conn.commit()


# ============================================================================
# API Clients
# ============================================================================


def gamma_get(path: str, timeout: int = 15) -> Optional[Any]:
    url = f"https://{GAMMA_HOST}{path}"
    try:
        result = subprocess.run(
            [
                "curl",
                "-s",
                "--resolve",
                f"{GAMMA_HOST}:443:{GAMMA_IP}",
                url,
                "-H",
                f"Host: {GAMMA_HOST}",
                "-H",
                "User-Agent: StealthTrace/3.0",
                "--max-time",
                str(timeout),
            ],
            capture_output=True,
            text=True,
            timeout=timeout + 5,
        )
        if result.returncode == 0:
            return json.loads(result.stdout)
    except Exception:
        pass
    return None


def data_api_get(path: str, timeout: int = 15) -> Optional[Any]:
    url = f"https://{DATA_HOST}{path}"
    try:
        resp = requests.get(
            url, timeout=timeout, headers={"User-Agent": "StealthTrace/3.0"}
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return None


class PolygonscanClient:
    def __init__(self, api_key: str = ""):
        self.api_key = api_key
        self._last_call = 0.0
        self._session = requests.Session()

    def _rate_limit(self):
        elapsed = time.time() - self._last_call
        if elapsed < POLYGONSCAN_DELAY:
            time.sleep(POLYGONSCAN_DELAY - elapsed)
        self._last_call = time.time()

    def _call(self, params: dict) -> dict:
        if self.api_key:
            params["apikey"] = self.api_key
        params["chainid"] = POLYGON_CHAIN_ID
        self._rate_limit()
        try:
            resp = self._session.get(POLYGONSCAN_API, params=params, timeout=15)
            return resp.json()
        except Exception as e:
            return {"status": "0", "result": str(e)}

    def get_usdc_transfers(self, address: str, days: int = 45) -> List[dict]:
        all_transfers = []
        for contract in [USDC_POLYGON, USDC_NATIVE]:
            page = 1
            while page <= 3:
                data = self._call(
                    {
                        "module": "account",
                        "action": "tokentx",
                        "contractaddress": contract,
                        "address": address,
                        "page": str(page),
                        "offset": "100",
                        "sort": "desc",
                    }
                )
                txs = data.get("result", [])
                if not isinstance(txs, list) or not txs:
                    break
                all_transfers.extend(txs)
                if len(txs) < 100:
                    break
                page += 1
        return all_transfers

    def get_first_tx(self, address: str) -> Optional[datetime]:
        data = self._call(
            {
                "module": "account",
                "action": "txlist",
                "address": address,
                "page": "1",
                "offset": "1",
                "sort": "asc",
            }
        )
        txs = data.get("result", [])
        if isinstance(txs, list) and txs:
            try:
                ts = int(txs[0].get("timeStamp", "0"))
                return datetime.fromtimestamp(ts, tz=timezone.utc)
            except (ValueError, KeyError):
                pass
        return None


# ============================================================================
# Auto-Seed Discovery
# ============================================================================


def discover_seeds_from_leaderboard(db: WatchedWalletDB) -> int:
    added = 0

    data = data_api_get("/v1/leaderboard?limit=50&timePeriod=ALL&sortBy=pnl")
    if isinstance(data, list):
        for entry in data:
            addr = (
                entry.get("proxyWallet")
                or entry.get("user")
                or entry.get("address")
                or ""
            )
            if addr and addr.startswith("0x") and len(addr) == 42:
                db.add_seed(addr.lower(), "leaderboard_pnl")
                added += 1

    data = data_api_get("/v1/leaderboard?limit=30&timePeriod=DAY&sortBy=pnl")
    if isinstance(data, list):
        for entry in data:
            addr = (
                entry.get("proxyWallet")
                or entry.get("user")
                or entry.get("address")
                or ""
            )
            if addr and addr.startswith("0x") and len(addr) == 42:
                db.add_seed(addr.lower(), "leaderboard_daily")
                added += 1

    return added


def discover_seeds_from_obscure_winners(
    db: WatchedWalletDB, markets: List[dict]
) -> int:
    """Find wallets winning on obscure markets — add as new seeds."""
    added = 0
    obscure_markets = [m for m in markets if _market_volume(m) < OBSCURE_VOLUME_MAX]

    for m in obscure_markets[:20]:
        slug = m.get("slug", "")
        if not slug:
            continue
        data = data_api_get(f"/v1/trades?slug={slug}&limit=10&sort=profit&order=desc")
        if not isinstance(data, list):
            continue
        for trade in data:
            addr = (
                trade.get("proxyWallet")
                or trade.get("user")
                or trade.get("address")
                or ""
            )
            pnl = float(trade.get("pnl") or trade.get("realizedPnl") or 0)
            if addr and addr.startswith("0x") and len(addr) == 42 and pnl > 50:
                db.add_seed(addr.lower(), f"obscure_winner_{slug[:20]}")
                added += 1
    return added


# ============================================================================
# 5-Layer Detection
# ============================================================================


def _market_volume(m: dict) -> float:
    try:
        return float(m.get("volume", 0) or 0)
    except (ValueError, TypeError):
        return 0.0


def layer1_funding_trace(
    candidate: str, transfers: List[dict], seeds: List[str]
) -> Tuple[int, Optional[str], str]:
    score = 0
    funding_source = None
    funding_label = "unknown"
    seed_set = {s.lower() for s in seeds}
    whale_senders: Dict[str, float] = defaultdict(float)

    for tx in transfers:
        sender = tx.get("from", "").lower()
        receiver = tx.get("to", "").lower()
        try:
            value = int(tx.get("value", "0")) / 1e6
        except (ValueError, TypeError):
            continue

        if receiver != candidate.lower() or value < MIN_FUNDING_USDC:
            continue

        if sender in seed_set:
            whale_senders[sender] += value

    if whale_senders:
        score = min(30, 10 + len(whale_senders) * 5)
        best = max(whale_senders, key=whale_senders.get)
        funding_source = best
        funding_label = f"whale_cluster_{best[:8]}"
    else:
        sender_counts: Dict[str, int] = defaultdict(int)
        for tx in transfers:
            if tx.get("to", "").lower() == candidate.lower():
                sender_counts[tx.get("from", "").lower()] += 1
        repeat = {s: c for s, c in sender_counts.items() if c >= 3}
        if repeat:
            score = 15
            funding_label = "stealth_cluster"
            funding_source = list(repeat.keys())[0]

    return score, funding_source, funding_label


def layer2_obscure_mastery(
    trades: List[dict], markets: List[dict]
) -> Tuple[int, float, List[str]]:
    if not trades:
        return 0, 0.0, []

    vol_map = {}
    for m in markets:
        mid = m.get("conditionId") or m.get("id") or m.get("slug", "")
        v = _market_volume(m)
        if mid and v:
            vol_map[str(mid)] = v

    wins = 0
    total = 0
    obscure_names = []
    for t in trades:
        mid = t.get("conditionId") or t.get("market") or t.get("condition_id") or ""
        vol = vol_map.get(str(mid), 0)
        if vol == 0 or vol >= OBSCURE_VOLUME_MAX:
            continue
        total += 1
        pnl = float(t.get("pnl") or t.get("realizedPnl") or 0)
        if pnl > 0:
            wins += 1
        name = t.get("title") or t.get("market_slug") or str(mid)[:16]
        if name not in obscure_names:
            obscure_names.append(name)

    rate = wins / total if total > 0 else 0.0
    score = min(25, int(rate * 25)) if total >= 5 else int(rate * 15)
    return score, rate, obscure_names[:5]


def layer3_timing_anomaly(trades: List[dict]) -> Tuple[int, List[str]]:
    if not trades:
        return 0, []
    anomalies = []
    now = datetime.now(timezone.utc)
    for t in trades[:20]:
        ts_str = t.get("createdAt") or t.get("timestamp") or ""
        if not ts_str:
            continue
        try:
            if isinstance(ts_str, (int, float)):
                tt = datetime.fromtimestamp(ts_str, tz=timezone.utc)
            else:
                tt = datetime.fromisoformat(str(ts_str).replace("Z", "+00:00"))
        except (ValueError, TypeError, OSError):
            continue
        hours = (now - tt).total_seconds() / 3600
        size = float(t.get("size") or t.get("volume") or 0)
        if size > 50:
            anomalies.append(f"trade_{hours:.0f}h_ago_size_{size:.0f}")
    if len(anomalies) >= 3:
        return 20, anomalies[:5]
    if len(anomalies) >= 1:
        return 10, anomalies[:5]
    return 0, []


def layer4_low_profile(age_days: float, volume: float, is_leaderboard: bool) -> int:
    s = 0
    if not is_leaderboard:
        s += 10
    if age_days < STEALTH_WALLET_MAX_AGE_DAYS:
        s += 3
    if volume < 50000:
        s += 2
    return min(15, s)


def layer5_cluster(
    candidate: str, all_candidates: List[dict], transfers: List[dict]
) -> int:
    our_senders = set()
    for tx in transfers:
        if tx.get("to", "").lower() == candidate.lower():
            our_senders.add(tx.get("from", "").lower())
    for other in all_candidates:
        if other.get("address") == candidate:
            continue
        if our_senders & set(other.get("funding_senders", [])):
            return 5
    return 0


# ============================================================================
# Grok Deep Analysis
# ============================================================================

GROK_SYSTEM = "You are a stealth wallet analyst for Polymarket. Output ONLY valid JSON. No markdown, no filler."

GROK_PROMPT_TEMPLATE = """Analyze this Polymarket wallet for stealth/insider edge patterns.

WALLET: {address}
AGE: {age_days} days
TOTAL PNL: ${total_pnl:.2f}
OBSCURE WIN RATE: {obscure_wr:.0%}
STEALTH SCORE: {score}/100
FUNDING: {funding_label}
SUSPICIOUS TRADES: {anomaly_count}

LAYER SCORES:
  L1 (Funding Trace): {l1}/30
  L2 (Obscure Mastery): {l2}/25
  L3 (Timing Anomaly): {l3}/20
  L4 (Low Profile): {l4}/15
  L5 (Cluster): {l5}/10

Respond with JSON:
{{
  "behavioral_read": "1-2 sentence behavioral analysis",
  "edge_type": "INSIDER_MODEL / EARLY_DATA / WHALE_FUNDED / CLUSTER / UNCLEAR",
  "confidence": "HIGH / MEDIUM / LOW",
  "red_flags": ["list any concerns"],
  "recommended_action": "MONITOR_FUNDING / AUTO_WATCH / SKIP",
  "suggested_size_pct": 1.5
}}"""


def analyze_with_grok(profile: dict) -> dict:
    if not XAI_API_KEY:
        return {
            "confidence": "LOW",
            "recommended_action": "MONITOR_FUNDING",
            "notes": "no XAI key",
        }

    prompt = GROK_PROMPT_TEMPLATE.format(
        address=profile.get("address", "unknown"),
        age_days=profile.get("wallet_age_days", 999),
        total_pnl=profile.get("total_pnl", 0),
        obscure_wr=profile.get("obscure_win_rate", 0),
        score=profile.get("total_score", 0),
        funding_label=profile.get("funding_label", "unknown"),
        anomaly_count=len(profile.get("timing_anomalies", [])),
        l1=profile.get("l1_score", 0),
        l2=profile.get("l2_score", 0),
        l3=profile.get("l3_score", 0),
        l4=profile.get("l4_score", 0),
        l5=profile.get("l5_score", 0),
    )

    try:
        resp = requests.post(
            XAI_API_URL,
            headers={
                "Authorization": f"Bearer {XAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": XAI_MODEL,
                "messages": [
                    {"role": "system", "content": GROK_SYSTEM},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.3,
                "response_format": {"type": "json_object"},
            },
            timeout=30,
        )
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        return json.loads(content)
    except Exception as e:
        return {
            "confidence": "LOW",
            "recommended_action": "MONITOR_FUNDING",
            "notes": f"grok error: {e}",
        }


# ============================================================================
# Main Scanner
# ============================================================================


def monitor_positions(db: WatchedWalletDB, markets: List[dict]):
    """Query recent trades for watched wallets and populate wallet_positions."""
    wallets = db.get_watchable(min_score=0)
    if not wallets:
        return

    vol_map = {}
    for m in markets:
        mid = m.get("conditionId") or m.get("id") or m.get("slug", "")
        v = _market_volume(m)
        q = m.get("question", "")
        if mid and v:
            vol_map[str(mid)] = (v, q)

    db.clear_stale_positions(max_age_hours=48)
    total_positions = 0

    for w in wallets[:15]:
        address = w["address"]
        trades = data_api_get(f"/v1/trades?user={address}&limit=25")
        if not isinstance(trades, list):
            continue

        seen_conditions = set()
        for t in trades:
            cid = t.get("conditionId") or t.get("condition_id") or t.get("market") or ""
            if not cid or cid in seen_conditions:
                continue
            seen_conditions.add(cid)

            vol_info = vol_map.get(str(cid), (0, ""))
            market_vol = vol_info[0]
            question = vol_info[1] or t.get("title") or t.get("market_slug") or ""

            side = t.get("side") or ""
            outcome = "YES" if side.upper() == "BUY" else "NO"
            try:
                price = float(t.get("price") or t.get("avgPrice") or 0.5)
            except (ValueError, TypeError):
                price = 0.5
            try:
                size = float(t.get("size") or t.get("volume") or 0)
            except (ValueError, TypeError):
                size = 0

            if size <= 0:
                continue

            db.upsert_position(
                address,
                {
                    "condition_id": cid,
                    "question": question,
                    "outcome": outcome,
                    "size_usdc": size * price,
                    "price": price,
                    "market_volume": market_vol,
                },
            )
            total_positions += 1

    if total_positions:
        print(f"  → {total_positions} positions tracked", file=sys.stderr)


def run_scan(db: WatchedWalletDB, polygonscan: PolygonscanClient) -> dict:
    """Full LAYER 1-5 scan. Returns stats dict."""
    stats = {"seeds_scanned": 0, "candidates_found": 0, "promoted": 0, "blacklisted": 0}

    print(
        f"\n◆ StealthTrace v3 — scan start {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}",
        file=sys.stderr,
    )

    # Step 1: Fetch markets for obscure filtering
    print("→ Fetching markets...", file=sys.stderr)
    raw_markets = gamma_get("/markets?limit=200&order=volume&ascending=false")
    markets = raw_markets if isinstance(raw_markets, list) else []
    print(f"  {len(markets)} markets loaded", file=sys.stderr)

    # Step 2: Auto-discover seeds
    print("→ Discovering seeds...", file=sys.stderr)
    lb_added = discover_seeds_from_leaderboard(db)
    obs_added = discover_seeds_from_obscure_winners(db, markets)
    print(
        f"  Added {lb_added} leaderboard seeds, {obs_added} obscure winner seeds",
        file=sys.stderr,
    )

    # Step 3: Get active seeds
    seeds = db.get_active_seeds()[:MAX_SEEDS_PER_SCAN]
    if not seeds:
        print("  No seeds found — need leaderboard API access", file=sys.stderr)
        return stats
    print(f"  {len(seeds)} active seeds", file=sys.stderr)

    # Step 4: Trace funding from seeds -> find candidates
    print("→ Tracing funding...", file=sys.stderr)
    candidates: Dict[str, dict] = {}

    for i, seed in enumerate(seeds):
        transfers = polygonscan.get_usdc_transfers(seed, days=45)
        stats["seeds_scanned"] += 1

        for tx in transfers:
            receiver = tx.get("to", "").lower()
            try:
                value = int(tx.get("value", "0")) / 1e6
            except (ValueError, TypeError):
                continue
            if value < MIN_FUNDING_USDC:
                continue
            if receiver in {s.lower() for s in seeds}:
                continue
            if receiver not in candidates:
                candidates[receiver] = {
                    "address": receiver,
                    "funding_senders": set(),
                    "funding_total": 0.0,
                    "funding_txs": [],
                }
            candidates[receiver]["funding_senders"].add(tx.get("from", "").lower())
            candidates[receiver]["funding_total"] += value
            candidates[receiver]["funding_txs"].append(tx)

        if (i + 1) % 10 == 0:
            print(
                f"  Traced {i + 1}/{len(seeds)} seeds, {len(candidates)} candidates",
                file=sys.stderr,
            )

    stats["candidates_found"] = len(candidates)
    print(f"→ {len(candidates)} candidate wallets", file=sys.stderr)

    # Step 5: Score candidates
    print("→ Scoring...", file=sys.stderr)
    all_candidates_list = [
        {"address": addr, "funding_senders": list(c["funding_senders"])}
        for addr, c in candidates.items()
    ]

    results = []
    for i, (address, info) in enumerate(
        list(candidates.items())[:MAX_CANDIDATES_PER_SCAN]
    ):
        trades = data_api_get(f"/v1/trades?user={address}&limit=50") or []

        first_tx = polygonscan.get_first_tx(address)
        age_days = (datetime.now(timezone.utc) - first_tx).days if first_tx else 999

        l1, fund_src, fund_label = layer1_funding_trace(
            address, info["funding_txs"], seeds
        )
        l2, obs_wr, obs_markets = layer2_obscure_mastery(
            trades if isinstance(trades, list) else [], markets
        )
        l3, anomalies = layer3_timing_anomaly(
            trades if isinstance(trades, list) else []
        )
        l4 = layer4_low_profile(age_days, info["funding_total"], False)
        l5 = layer5_cluster(address, all_candidates_list, info["funding_txs"])

        total = l1 + l2 + l3 + l4 + l5

        tier = "STEALTH" if total >= 70 else "SEMI-STEALTH" if total >= 50 else "WATCH"

        results.append(
            {
                "address": address,
                "tier": tier,
                "total_score": total,
                "l1_score": l1,
                "l2_score": l2,
                "l3_score": l3,
                "l4_score": l4,
                "l5_score": l5,
                "funding_source": fund_src,
                "funding_label": fund_label,
                "funding_total": info["funding_total"],
                "obscure_win_rate": obs_wr,
                "obscure_markets": obs_markets,
                "timing_anomalies": anomalies,
                "wallet_age_days": age_days,
                "total_pnl": info["funding_total"],
            }
        )

    results.sort(key=lambda r: r["total_score"], reverse=True)

    # Step 6: Grok analysis on top candidates + write to DB
    print("→ Grok analysis...", file=sys.stderr)
    promoted = 0
    for wallet in results[:10]:
        if wallet["total_score"] < MIN_SCORE_TO_WATCH:
            continue

        analysis = (
            analyze_with_grok(wallet)
            if wallet["total_score"] >= 40
            else {"confidence": "LOW", "recommended_action": "MONITOR_FUNDING"}
        )

        action = analysis.get("recommended_action", "MONITOR_FUNDING")
        if wallet["total_score"] >= MIN_SCORE_TO_AUTO and action != "SKIP":
            action = "AUTO_WATCH"

        # Determine primary edge
        scores = {
            "L1": wallet["l1_score"],
            "L2": wallet["l2_score"],
            "L3": wallet["l3_score"],
            "L4": wallet["l4_score"],
            "L5": wallet["l5_score"],
        }
        top_layers = sorted(scores, key=scores.get, reverse=True)[:2]
        primary_edge = " + ".join(top_layers)

        db_entry = {
            **wallet,
            "score": wallet["total_score"],
            "primary_edge": primary_edge,
            "stealth_level": "HIGH" if wallet["total_score"] >= 70 else "MEDIUM",
            "copy_action": action,
            "suggested_size_pct": analysis.get("suggested_size_pct", 1.5),
            "confidence": analysis.get("confidence", "MEDIUM"),
            "behavioral_read": analysis.get("behavioral_read", ""),
            "edge_type": analysis.get("edge_type", "UNCLEAR"),
            "red_flags": analysis.get("red_flags", []),
            "grok_raw": analysis,
        }
        db.upsert_wallet(db_entry)
        promoted += 1

        tier_emoji = (
            "🔴"
            if wallet["tier"] == "STEALTH"
            else "🟡"
            if wallet["tier"] == "SEMI-STEALTH"
            else "⚪"
        )
        print(
            f"  {tier_emoji} {wallet['tier']} {wallet['address'][:12]}... score={wallet['total_score']} {action}",
            file=sys.stderr,
        )

    stats["promoted"] = promoted

    # Step 7: Prune wallets that hit public leaderboards
    lb_data = data_api_get("/v1/leaderboard?limit=300&timePeriod=WEEK&sortBy=volume")
    if isinstance(lb_data, list):
        lb_addrs = {
            (e.get("proxyWallet") or e.get("user") or e.get("address") or "").lower()
            for e in lb_data
        }
        for w in db.get_watchable(min_score=0):
            if w["address"].lower() in lb_addrs:
                db.blacklist(w["address"], "appeared_on_public_leaderboard")
                stats["blacklisted"] += 1
                print(
                    f"  ✗ Blacklisted {w['address'][:12]}... (public leaderboard)",
                    file=sys.stderr,
                )

    # Step 8: Monitor positions for copy-trading
    print("→ Monitoring positions...", file=sys.stderr)
    monitor_positions(db, markets)

    # Step 9: Telegram digest
    top_wallets = db.get_watchable(min_score=MIN_SCORE_TO_WATCH)[:5]
    if top_wallets:
        send_digest(top_wallets)

    db.log_scan(
        seeds_scanned=stats["seeds_scanned"],
        candidates=stats["candidates_found"],
        promoted=stats["promoted"],
        blacklisted=stats["blacklisted"],
        notes="",
    )
    print(
        f"→ Scan complete: {promoted} promoted, {stats['blacklisted']} blacklisted",
        file=sys.stderr,
    )
    return stats


# ============================================================================
# Telegram
# ============================================================================


def send_digest(wallets: List[dict]):
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return

    lines = [
        f"🕵️ <b>STEALTH TRACE v3 — {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}</b>\n"
    ]
    for i, w in enumerate(wallets[:5]):
        emoji = (
            "🔴"
            if w["tier"] == "STEALTH"
            else "🟡"
            if w["tier"] == "SEMI-STEALTH"
            else "⚪"
        )
        lines.append(
            f"{emoji} <b>{w['tier']}</b> <code>{w['address'][:12]}...</code>\n"
            f"  Score: {w['score']}/100 | Edge: {w.get('primary_edge', '?')}\n"
            f"  Action: {w.get('copy_action', '?')} | {w.get('confidence', '?')}\n"
            f"  {w.get('behavioral_read', 'no analysis')[:80]}\n"
        )
    lines.append(f"Total watchable: {len(wallets)} | Daily risk: ≤8% bankroll")

    try:
        requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
            data={
                "chat_id": TELEGRAM_CHAT_ID,
                "text": "\n".join(lines),
                "parse_mode": "HTML",
            },
            timeout=10,
        )
    except Exception:
        pass


# ============================================================================
# Main Loop
# ============================================================================


def main():
    parser = argparse.ArgumentParser(
        description="StealthTrace v3 — Autonomous Obscure Edge Hunter"
    )
    parser.add_argument("--once", action="store_true", help="Single scan, then exit")
    parser.add_argument(
        "--interval", type=int, default=SCAN_INTERVAL, help="Seconds between scans"
    )
    args = parser.parse_args()

    db = WatchedWalletDB()
    polygonscan = PolygonscanClient(POLYGONSCAN_KEY)

    # Bootstrap: add initial seed wallets from existing stealthtrace
    initial_seeds = [
        "0x9F7bF441f1443513ecbf4C3E5Ef3940573198cf7",
        "0x53562E8eceE42856B0c2dD65E42c5666676C7742",
        "0x9ADBe044fE2E4E6F063b91c847B19bE2A6a5A7b6",
    ]
    for s in initial_seeds:
        db.add_seed(s.lower(), "initial_seed")

    print(f"◆ StealthTrace v3 started", file=sys.stderr)
    print(f"  DB: {DB_PATH}", file=sys.stderr)
    print(f"  Interval: {args.interval}s", file=sys.stderr)
    print(f"  XAI key: {'yes' if XAI_API_KEY else 'no'}", file=sys.stderr)
    print(f"  Polygonscan key: {'yes' if POLYGONSCAN_KEY else 'no'}", file=sys.stderr)

    if args.once:
        run_scan(db, polygonscan)
        return

    while True:
        try:
            run_scan(db, polygonscan)
        except Exception as e:
            print(f"✗ Scan error: {e}", file=sys.stderr)

        print(f"  Sleeping {args.interval}s...", file=sys.stderr)
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
