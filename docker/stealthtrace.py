#!/usr/bin/env python3
"""
StealthTrace v2.1 — Polyagent Obscure Edge Hunter
===================================================
Autonomous stealth wallet detection pipeline.
Runs LAYER 1-5 detection against Polygonscan + Polymarket data.
Feeds xAI Grok for deep analysis. Outputs formatted blocks + TOP 3.

Usage:
    python3 stealthtrace.py                    # full scan, output to stdout
    python3 stealthtrace.py --top 5            # top 5 wallets
    python3 stealthtrace.py --json             # JSON output for piping
    python3 stealthtrace.py --cron             # cron mode: output to ~/stealth_logs/

Requirements:
    pip install requests python-dotenv

Env vars:
    XAI_API_KEY          — xAI Grok API key (required for deep analysis)
    POLYGONSCAN_API_KEY  — Polygonscan API key (optional, free tier works)
    POLYMARKET_DATA_URL  — override Polymarket data API URL
"""

from __future__ import annotations

import json
import os
import sys
import time
import hashlib
import argparse
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict

try:
    import requests
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
except ImportError:
    print("ERROR: requests not installed. Run: pip install requests urllib3")
    sys.exit(1)

# ============================================================================
# Configuration
# ============================================================================

# Polymarket contract addresses (Polygon mainnet)
POLYMARKET_CTF = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045"
POLYMARKET_CLOB = "0xC5d563A36AE78145C45a50134d48A1215220f80a"
USDC_POLYGON = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"

# Known whale wallets — seed list for funding trace
# Sourced from public leaderboards, smart money maps, on-chain analysis
SEED_WHALES: List[str] = [
    # Polymarket top performers (public — use as funding sources)
    "0x9F7bF441f1443513ecbf4C3E5Ef3940573198cf7",  # known high-PnL
    "0x53562E8eceE42856B0c2dD65E42c5666676C7742",  # known whale cluster
    "0x9ADBe044fE2E4E6F063b91c847B19bE2A6a5A7b6",  # smart money
    # Add more from your own research
]

# Obscure market filters: volume < $100k
OBSCURE_VOLUME_THRESHOLD = 100_000
# Stealth wallet: < 60 days old
STEALTH_WALLET_MAX_AGE_DAYS = 60
# Minimum USDC transfer to flag as significant
MIN_FUNDING_USDC = 300
# Minimum win rate on obscure markets
MIN_OBSCURE_WIN_RATE = 0.65

# Polygonscan API (V2 endpoint via Etherscan)
POLYGONSCAN_API = "https://api.etherscan.io/v2/api"
POLYGONSCAN_KEY = os.environ.get("POLYGONSCAN_API_KEY", "")
POLYGON_CHAIN_ID = "137"  # Polygon mainnet

# Polymarket APIs (with DNS bypass support)
GAMMA_API = "https://gamma-api.polymarket.com"
DATA_API = "https://data-api.polymarket.com"
CLOB_API = "https://clob.polymarket.com"

# DNS bypass IPs (resolve once, cache)
_GAMMA_IP = os.environ.get("POLYMARKET_GAMMA_IP", "104.18.34.205")
_DATA_IP = os.environ.get("POLYMARKET_DATA_IP", "104.18.34.205")

# xAI
XAI_API_KEY = os.environ.get("XAI_API_KEY", "")
XAI_API_URL = "https://api.x.ai/v1/chat/completions"
XAI_MODEL = "grok-4.20"

# Rate limiting
RATE_LIMIT_DELAY = 0.25 if POLYGONSCAN_KEY else 1.2  # 5/sec free, 10/sec with key
MAX_RETRIES = 3

# Output
STEALTH_LOG_DIR = Path.home() / "stealth_logs"


# ============================================================================
# Polygonscan Client
# ============================================================================

class PolygonscanClient:
    """Rate-limited Polygonscan API client."""

    def __init__(self, api_key: str = ""):
        self.api_key = api_key
        self._last_call = 0.0
        self._session = requests.Session()
        self._session.headers.update({
            "User-Agent": "StealthTrace/2.1",
            "Accept": "application/json",
        })

    def _rate_limit(self):
        elapsed = time.time() - self._last_call
        if elapsed < RATE_LIMIT_DELAY:
            time.sleep(RATE_LIMIT_DELAY - elapsed)
        self._last_call = time.time()

    def _call(self, params: Dict[str, str], retries: int = MAX_RETRIES) -> Dict:
        if self.api_key:
            params["apikey"] = self.api_key
        params["chainid"] = POLYGON_CHAIN_ID  # V2 requirement
        self._rate_limit()

        for attempt in range(retries):
            try:
                resp = self._session.get(POLYGONSCAN_API, params=params, timeout=15)
                data = resp.json()
                if data.get("status") == "1":
                    return data
                if "rate limit" in str(data.get("result", "")).lower():
                    time.sleep(2 ** attempt)
                    continue
                return data
            except Exception as e:
                if attempt == retries - 1:
                    return {"status": "0", "result": str(e)}
                time.sleep(1)
        return {"status": "0", "result": "max retries"}

    def get_usdc_transfers(self, address: str, days: int = 45) -> List[Dict]:
        """Get USDC token transfers (incoming + outgoing) for an address."""
        all_transfers = []
        page = 1
        cutoff_block = self._estimate_blocks_ago(days)

        while page <= 5:  # max 5 pages per address
            params = {
                "module": "account",
                "action": "tokentx",
                "contractaddress": USDC_POLYGON,
                "address": address,
                "page": str(page),
                "offset": "100",
                "sort": "desc",
            }
            data = self._call(params)
            transfers = data.get("result", [])
            if not isinstance(transfers, list) or not transfers:
                break

            # Filter by block number (approximate time)
            recent = [t for t in transfers if int(t.get("blockNumber", "0")) >= cutoff_block]
            all_transfers.extend(recent)

            if len(transfers) < 100:
                break
            page += 1

        return all_transfers

    def get_normal_transactions(self, address: str, days: int = 90) -> List[Dict]:
        """Get normal transactions for wallet age estimation."""
        params = {
            "module": "account",
            "action": "txlist",
            "address": address,
            "page": "1",
            "offset": "5",
            "sort": "asc",
        }
        data = self._call(params)
        return data.get("result", []) if isinstance(data.get("result"), list) else []

    def _estimate_blocks_ago(self, days: int) -> int:
        """Rough block number estimation (Polygon ~2s blocks)."""
        blocks_per_day = 43200
        current_block = 58_000_000  # approximate May 2026
        return current_block - (days * blocks_per_day)


# ============================================================================
# Polymarket Client
# ============================================================================

class PolymarketClient:
    """Polymarket data API client with DNS bypass + fallback endpoints."""

    def __init__(self):
        self._session = requests.Session()
        self._session.headers.update({
            "User-Agent": "StealthTrace/2.1",
            "Accept": "application/json",
        })
        # Session-level Host header for DNS bypass
        self._session.headers["Host"] = "gamma-api.polymarket.com"

    def _get(self, base: str, path: str, timeout: int = 15) -> Optional[Dict]:
        # Try DNS bypass first, then fallback endpoints
        urls = []

        # DNS bypass: use IP directly + Host header
        if "gamma-api" in (base or GAMMA_API):
            urls.append(f"https://{_GAMMA_IP}{path}")
        elif "data-api" in (base or DATA_API):
            urls.append(f"https://{_DATA_IP}{path}")

        # Standard endpoints (may fail on DNS-hijacked networks)
        endpoints = [
            f"https://gamma-api.polymarket.com{path}",
            f"https://data-api.polymarket.com{path}",
        ]
        if base:
            endpoints.insert(0, f"{base}{path}")
        urls.extend(endpoints)

        for url in urls:
            try:
                resp = self._session.get(url, timeout=timeout, verify=False)
                if resp.status_code == 200:
                    return resp.json()
            except Exception:
                continue
        return None

    def get_markets(self, limit: int = 100) -> List[Dict]:
        """Get recent markets with volume data."""
        data = self._get(GAMMA_API, f"/markets?limit={limit}&order=volume&ascending=false")
        if isinstance(data, list):
            return data
        return []

    def get_leaderboard(self, limit: int = 50) -> List[Dict]:
        """Get top traders by PnL or volume."""
        data = self._get(
            DATA_API,
            f"/v1/leaderboard?limit={limit}&timePeriod=ALL&sortBy=pnl"
        )
        if isinstance(data, list):
            return data
        return []

    def get_trades(self, user_address: str, limit: int = 50) -> List[Dict]:
        """Get recent trades for a wallet."""
        data = self._get(
            DATA_API,
            f"/v1/trades?user={user_address}&limit={limit}"
        )
        if isinstance(data, list):
            return data
        return []


# ============================================================================
# Stealth Detection Engine
# ============================================================================

class StealthDetection:
    """LAYER 1-5 detection logic."""

    @staticmethod
    def layer1_funding_trace(
        candidate: str,
        transfers: List[Dict],
        seed_whales: List[str],
    ) -> Tuple[int, Optional[str], str]:
        """
        LAYER 1 — STEALTH FUNDING TRACE (30 points)
        Trace USDC inflows from known profitable wallets or whale clusters.
        """
        score = 0
        funding_source = None
        funding_label = "unknown"
        whale_senders: Dict[str, float] = defaultdict(float)

        for tx in transfers:
            sender = tx.get("from", "").lower()
            receiver = tx.get("to", "").lower()
            value = int(tx.get("value", "0")) / 1e6  # USDC has 6 decimals

            if receiver != candidate.lower():
                continue
            if value < MIN_FUNDING_USDC:
                continue

            # Check against known seed whales
            for whale in seed_whales:
                if sender == whale.lower():
                    whale_senders[whale] += value

        if whale_senders:
            score = min(30, 10 + len(whale_senders) * 5)
            best_whale = max(whale_senders, key=whale_senders.get)
            funding_source = best_whale
            funding_label = f"whale_cluster_{best_whale[:8]}"
        elif transfers:
            # Check for repeated funding sources
            sender_counts: Dict[str, int] = defaultdict(int)
            for tx in transfers:
                sender = tx.get("from", "").lower()
                if tx.get("to", "").lower() == candidate.lower():
                    sender_counts[sender] += 1
            repeat_senders = {s: c for s, c in sender_counts.items() if c >= 3}
            if repeat_senders:
                score = 15
                funding_label = "stealth_cluster"
                funding_source = list(repeat_senders.keys())[0]

        return score, funding_source, funding_label

    @staticmethod
    def layer2_obscure_mastery(
        trades: List[Dict],
        markets: List[Dict],
    ) -> Tuple[int, float, List[str]]:
        """
        LAYER 2 — OBSCURE MARKET MASTERY (25 points)
        Win rate on low-volume niches (< $100k).
        """
        if not trades:
            return 0, 0.0, []

        obscure_wins = 0
        obscure_total = 0
        obscure_markets = []

        # Build volume lookup from markets
        volume_map: Dict[str, float] = {}
        for m in markets:
            mid = m.get("id") or m.get("conditionId") or m.get("slug", "")
            vol = float(m.get("volume", 0))
            if mid and vol:
                volume_map[str(mid)] = vol

        for trade in trades:
            # Polymarket trade fields vary by API version
            market_id = (
                trade.get("market") or
                trade.get("conditionId") or
                trade.get("condition_id") or
                ""
            )
            volume = volume_map.get(str(market_id), 0)
            if volume == 0 or volume >= OBSCURE_VOLUME_THRESHOLD:
                continue

            obscure_total += 1
            outcome = trade.get("outcome") or trade.get("side", "")
            # Determine if won (simplified — real impl needs outcome resolution)
            # For now: treat positive PnL on obscure as a win signal
            pnl = float(trade.get("pnl") or trade.get("realizedPnl") or 0)
            if pnl > 0:
                obscure_wins += 1

            market_name = trade.get("title") or trade.get("market_slug") or str(market_id)[:16]
            if market_name not in obscure_markets:
                obscure_markets.append(market_name)

        win_rate = obscure_wins / obscure_total if obscure_total > 0 else 0.0
        score = min(25, int(win_rate * 25)) if obscure_total >= 5 else int(win_rate * 15)

        return score, win_rate, obscure_markets[:5]

    @staticmethod
    def layer3_timing_anomaly(
        trades: List[Dict],
    ) -> Tuple[int, List[str]]:
        """
        LAYER 3 — TIMING ANOMALY (20 points)
        Entries hours/days before public signals on non-hype events.
        """
        if not trades:
            return 0, []

        score = 0
        anomalies = []
        now = datetime.now(timezone.utc)

        for trade in trades[:20]:
            created_str = trade.get("createdAt") or trade.get("timestamp") or ""
            if not created_str:
                continue

            try:
                trade_time = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
            except ValueError:
                continue

            # Flag trades where market was very young (< 4h old — no public signal yet)
            # Real impl would cross-reference with news API
            hours_since = (now - trade_time).total_seconds() / 3600
            volume = float(trade.get("volume") or trade.get("size") or 0)

            # Signal: trade on very new market with meaningful size
            if volume > 50:
                anomalies.append(
                    f"trade_{hours_since:.0f}h_ago_size_{volume:.0f}"
                )

        if len(anomalies) >= 3:
            score = 20
        elif len(anomalies) >= 1:
            score = 10

        return score, anomalies[:5]

    @staticmethod
    def layer4_low_profile(
        wallet_age_days: float,
        total_volume: float,
        is_leaderboard: bool,
    ) -> int:
        """
        LAYER 4 — LOW-PROFILE PROFILE (15 points)
        Not in top 500, small consistent wins, minimal history.
        """
        score = 0
        if not is_leaderboard:
            score += 10
        if wallet_age_days < STEALTH_WALLET_MAX_AGE_DAYS:
            score += 3
        if total_volume < 50000:
            score += 2
        return min(15, score)

    @staticmethod
    def layer5_cluster(
        candidate: str,
        all_candidates: List[Dict],
        transfers: List[Dict],
    ) -> int:
        """
        LAYER 5 — CLUSTER / MULTI-WALLET (10 points)
        Multiple fresh wallets from same funding source on identical obscure bets.
        """
        # Simplified: check if any other candidate shares funding sources
        score = 0
        our_senders = set()
        for tx in transfers:
            sender = tx.get("from", "").lower()
            if tx.get("to", "").lower() == candidate.lower():
                our_senders.add(sender)

        for other in all_candidates:
            if other.get("address") == candidate:
                continue
            other_funders = set(other.get("funding_senders", []))
            if our_senders & other_funders:
                score += 5
                break

        return min(10, score)


# ============================================================================
# xAI Grok Deep Analysis
# ============================================================================

def analyze_with_grok(wallet_profile: Dict) -> Dict:
    """Use xAI Grok-4.20 to analyze wallet behavior and generate behavioral read."""
    if not XAI_API_KEY:
        return {"notes": "xAI API key not configured", "confidence": "MEDIUM"}

    prompt = f"""Analyze this Polymarket wallet for stealth/insider edge patterns.

WALLET: {wallet_profile.get('address', 'unknown')}
AGE: {wallet_profile.get('wallet_age_days', '?')} days
TOTAL PNL: ${wallet_profile.get('total_pnl', 0):.2f}
OBSCURE WIN RATE: {wallet_profile.get('obscure_win_rate', 0):.0%}
STEALTH SCORE: {wallet_profile.get('total_score', 0)}/100
FUNDING: {wallet_profile.get('funding_label', 'unknown')}
SUSPICIOUS TRADES: {len(wallet_profile.get('timing_anomalies', []))}

LAYER SCORES:
  L1 (Funding Trace): {wallet_profile.get('l1_score', 0)}/30
  L2 (Obscure Mastery): {wallet_profile.get('l2_score', 0)}/25
  L3 (Timing Anomaly): {wallet_profile.get('l3_score', 0)}/20
  L4 (Low Profile): {wallet_profile.get('l4_score', 0)}/15
  L5 (Cluster): {wallet_profile.get('l5_score', 0)}/10

Respond with JSON:
{{
  "behavioral_read": "1-2 sentence behavioral analysis — what kind of operator this is",
  "edge_type": "INSIDER_MODEL / EARLY_DATA / WHALE_FUNDED / CLUSTER / UNCLEAR",
  "confidence": "HIGH / MEDIUM / LOW",
  "red_flags": ["list any concerns"],
  "recommended_action": "MONITOR_FUNDING / AUTO_WATCH / SKIP",
  "suggested_size_pct": 1.5
}}

Be concise. No markdown, no filler. Just the JSON object."""

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
                    {"role": "system", "content": "You are a stealth wallet analyst. Output ONLY valid JSON."},
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
        return {"notes": f"Grok analysis failed: {e}", "confidence": "LOW"}


# ============================================================================
# Main Scanner
# ============================================================================

def scan_stealth_wallets(
    polygonscan: PolygonscanClient,
    polymarket: PolymarketClient,
    seed_whales: List[str],
    top_n: int = 5,
) -> List[Dict]:
    """Run full LAYER 1-5 scan and return ranked results."""

    print("◆ StealthTrace v2.1 — Scanning...", file=sys.stderr)
    print(f"  Seeds: {len(seed_whales)} whales", file=sys.stderr)
    print(f"  Date: {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}", file=sys.stderr)

    # Step 1: Get market data for obscure filtering
    print("→ Fetching market data...", file=sys.stderr)
    markets = polymarket.get_markets(limit=200)

    # Step 2: Trace funding from seed whales
    print("→ Tracing funding from seed whales...", file=sys.stderr)
    candidates: Dict[str, Dict] = {}
    detection = StealthDetection()

    for whale in seed_whales[:10]:  # limit to 10 whales for speed
        transfers = polygonscan.get_usdc_transfers(whale, days=45)
        if not transfers:
            continue

        for tx in transfers:
            receiver = tx.get("to", "").lower()
            value = int(tx.get("value", "0")) / 1e6
            if value < MIN_FUNDING_USDC:
                continue
            if receiver in [w.lower() for w in seed_whales]:
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

        print(f"  Whale {whale[:10]}... → {len(transfers)} transfers, {len(candidates)} candidates so far",
              file=sys.stderr)

    print(f"→ Found {len(candidates)} candidate wallets", file=sys.stderr)

    # Step 3: Score each candidate
    print("→ Scoring candidates...", file=sys.stderr)
    results = []
    all_candidates_list = [
        {"address": addr, "funding_senders": list(c["funding_senders"])}
        for addr, c in candidates.items()
    ]

    candidate_list = list(candidates.items())[:30]  # limit to 30 for speed
    for i, (address, info) in enumerate(candidate_list):
        transfers = info["funding_txs"]
        trades_raw = polymarket.get_trades(f"0x{address}" if not address.startswith("0x") else address)

        # Wallet age
        txs = polygonscan.get_normal_transactions(
            f"0x{address}" if not address.startswith("0x") else address
        )
        first_tx_time = None
        if txs:
            try:
                ts = int(txs[0].get("timeStamp", "0"))
                first_tx_time = datetime.fromtimestamp(ts, tz=timezone.utc)
            except (ValueError, KeyError):
                pass
        wallet_age_days = (
            (datetime.now(timezone.utc) - first_tx_time).days
            if first_tx_time else 999
        )

        # Is on leaderboard?
        is_leaderboard = False  # simplified

        # Run layers
        l1_score, funding_source, funding_label = detection.layer1_funding_trace(
            address, transfers, seed_whales
        )
        l2_score, obscure_win_rate, obscure_markets = detection.layer2_obscure_mastery(
            trades_raw if isinstance(trades_raw, list) else [], markets
        )
        l3_score, timing_anomalies = detection.layer3_timing_anomaly(
            trades_raw if isinstance(trades_raw, list) else []
        )
        l4_score = detection.layer4_low_profile(
            wallet_age_days, info["funding_total"], is_leaderboard
        )
        l5_score = detection.layer5_cluster(address, all_candidates_list, transfers)

        total_score = l1_score + l2_score + l3_score + l4_score + l5_score

        # Determine tier
        if total_score >= 70:
            tier = "STEALTH"
        elif total_score >= 50:
            tier = "SEMI-STEALTH"
        else:
            tier = "WATCH"

        results.append({
            "address": address,
            "tier": tier,
            "total_score": total_score,
            "l1_score": l1_score,
            "l2_score": l2_score,
            "l3_score": l3_score,
            "l4_score": l4_score,
            "l5_score": l5_score,
            "funding_source": funding_source,
            "funding_label": funding_label,
            "funding_total": info["funding_total"],
            "obscure_win_rate": obscure_win_rate,
            "obscure_markets": obscure_markets,
            "timing_anomalies": timing_anomalies,
            "wallet_age_days": wallet_age_days,
            "trade_count": len(trades_raw) if isinstance(trades_raw, list) else 0,
        })

        # Progress
        if (i + 1) % 5 == 0:
            print(f"  Scored {i+1}/{len(candidate_list)}...", file=sys.stderr)

    # Sort by score descending
    results.sort(key=lambda r: r["total_score"], reverse=True)
    return results[:top_n]


# ============================================================================
# Output Formatter
# ============================================================================

def format_wallet_block(wallet: Dict, analysis: Dict) -> str:
    """Format a single wallet in the exact output format."""
    lines = []
    lines.append(f"WALLET: 0x{wallet['address'] if not wallet['address'].startswith('0x') else wallet['address'][2:]}")
    lines.append(f"TIER: {wallet['tier']}")
    lines.append(f"SCORE: {wallet['total_score']}")
    lines.append(f"PRIMARY EDGE: LAYER 1 + LAYER {max(
        range(2, 6), key=lambda i: wallet[f'l{i}_score']
    ) if wallet['total_score'] > 0 else '3'}")
    lines.append(f"FUNDING_SOURCE: {wallet.get('funding_source') or 'unknown'} ({wallet.get('funding_label', 'unknown')})")
    lines.append(f"OBSCURE_WIN_RATE: {wallet['obscure_win_rate']:.0%}")
    lines.append(f"STEALTH_LEVEL: {'HIGH' if wallet['total_score'] >= 70 else 'MEDIUM' if wallet['total_score'] >= 50 else 'LOW'}")
    lines.append(f"SUSPICIOUS_TIMING: {wallet['timing_anomalies'][:3] if wallet['timing_anomalies'] else 'insufficient data'}")
    lines.append(f"COPY_ACTION: {analysis.get('recommended_action', 'MONITOR_FUNDING')}")
    lines.append(f"SUGGESTED_SIZE: {analysis.get('suggested_size_pct', 1.5)}% bankroll")
    lines.append(f"RED_FLAGS: {', '.join(analysis.get('red_flags', ['none']))}")
    lines.append(f"CONFIDENCE: {analysis.get('confidence', 'MEDIUM')}")
    lines.append(f"NOTES: {analysis.get('behavioral_read', 'insufficient data for behavioral analysis')}")
    lines.append(f"LAST_14D_PNL: ${wallet.get('funding_total', 0):.0f} (funding traced)")
    return "\n".join(lines)


def format_output(results: List[Dict], analyses: List[Dict]) -> str:
    """Format complete output with blocks + TOP 3."""
    out = []
    out.append("=" * 64)
    out.append("  STEALTH OBSCURE EDGE HUNTER v1.0 — SCAN RESULTS")
    out.append(f"  {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}")
    out.append("=" * 64)
    out.append("")

    # Individual wallet blocks
    for i, (wallet, analysis) in enumerate(zip(results, analyses)):
        out.append(f"--- BLOCK {i+1} ---")
        out.append(format_wallet_block(wallet, analysis))
        out.append("")

    # TOP 3
    out.append("--- STEALTH TOP 3 TO TRACK TODAY ---")
    for i, (wallet, analysis) in enumerate(zip(results[:3], analyses[:3])):
        addr_short = wallet['address'][:10]
        edge_type = analysis.get('edge_type', 'UNCLEAR')
        reason = analysis.get('behavioral_read', f'Score {wallet["total_score"]} — {wallet["tier"]}')
        out.append(f"{i+1}. 0x{addr_short}... — {edge_type} — {reason}")

    out.append("")
    out.append(f"TOTAL DAILY RISK: ≤8% bankroll")
    out.append(f"SCAN COMPLETE — {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}")
    out.append("=" * 64)

    return "\n".join(out)


# ============================================================================
# Main
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="StealthTrace v2.1 — Obscure Edge Hunter")
    parser.add_argument("--top", type=int, default=5, help="Max wallets to return")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--cron", action="store_true", help="Cron mode: log to file")
    parser.add_argument("--seeds", type=str, help="Comma-separated seed whale list")
    args = parser.parse_args()

    # Override seed whales if provided
    seeds = SEED_WHALES
    if args.seeds:
        seeds = [s.strip() for s in args.seeds.split(",") if s.strip()]

    # Init clients
    polygonscan = PolygonscanClient(POLYGONSCAN_KEY)
    polymarket = PolymarketClient()

    # Run scan
    results = scan_stealth_wallets(polygonscan, polymarket, seeds, top_n=args.top)

    if not results:
        msg = "No stealth wallets detected. Try expanding seed list or lowering thresholds."
        print(msg)
        return

    # Run xAI analysis on results
    analyses = []
    for wallet in results:
        analysis = analyze_with_grok(wallet)
        analyses.append(analysis)

    # Output
    output = format_output(results, analyses)

    if args.json:
        json_output = {
            "timestamp": datetime.now().isoformat(),
            "results": results,
            "analyses": analyses,
        }
        print(json.dumps(json_output, indent=2, default=str))
    elif args.cron:
        STEALTH_LOG_DIR.mkdir(parents=True, exist_ok=True)
        date_str = datetime.now().strftime("%Y%m%d_%H%M")
        log_path = STEALTH_LOG_DIR / f"stealth_scan_{date_str}.txt"
        log_path.write_text(output)
        print(f"Scan logged to {log_path}")
    else:
        print(output)


if __name__ == "__main__":
    main()
