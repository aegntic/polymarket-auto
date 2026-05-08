#!/usr/bin/env python3
"""
Polygon RPC Transfer Tracer
============================
Direct on-chain USDC transfer tracing via Polygon JSON-RPC.
Replaces deprecated Polygonscan V1 API. Uses eth_getLogs for
ERC-20 Transfer events. No API key required.

Usage:
    python3 polygon_rpc.py 0xWHALE_ADDRESS  # trace USDC outflows from wallet
    python3 polygon_rpc.py --scan           # scan for stealth candidates
"""

import json
import os
import sys
import time
from datetime import datetime, timezone
from collections import defaultdict

try:
    import requests
except ImportError:
    print("ERROR: pip install requests")
    sys.exit(1)

# ============================================================================
# Config
# ============================================================================

USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
CTF_ADDRESS = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045"
CLOB_ADDRESS = "0xC5d563A36AE78145C45a50134d48A1215220f80a"

# Public Polygon RPC endpoints (rotate if rate-limited)
RPC_ENDPOINTS = [
    "https://polygon-rpc.com",
    "https://rpc-mainnet.maticvigil.com",
    "https://polygon-mainnet.g.alchemy.com/v2/demo",
    "https://rpc.ankr.com/polygon",
]

# USDC Transfer event signature: keccak("Transfer(address,address,uint256)")
TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"


def rpc_call(method: str, params: list, endpoint_idx: int = 0) -> dict | None:
    """Make a JSON-RPC call to Polygon."""
    for attempt in range(len(RPC_ENDPOINTS)):
        ep = RPC_ENDPOINTS[(endpoint_idx + attempt) % len(RPC_ENDPOINTS)]
        try:
            resp = requests.post(
                ep,
                json={"jsonrpc": "2.0", "method": method, "params": params, "id": 1},
                timeout=15,
            )
            if resp.status_code == 200:
                data = resp.json()
                if "result" in data:
                    return data["result"]
                if "error" in data:
                    print(f"  RPC error on {ep[:30]}: {data['error'].get('message','?')[:80]}", file=sys.stderr)
        except Exception as e:
            print(f"  RPC fail {ep[:30]}: {e}", file=sys.stderr)
        time.sleep(0.2)
    return None


def get_current_block() -> int:
    """Get latest block number."""
    result = rpc_call("eth_blockNumber", [])
    if result:
        return int(result, 16)
    return 58_000_000  # fallback


def get_usdc_transfers(
    wallet: str, from_block: int, to_block: int | str = "latest"
) -> list:
    """
    Get USDC Transfer events involving a wallet.
    Uses eth_getLogs with Transfer event topic + indexed address params.
    """
    wallet_padded = wallet.lower().replace("0x", "0x").rjust(66, "0")

    # Query transfers FROM this wallet (outflows)
    out_logs = rpc_call("eth_getLogs", [{
        "fromBlock": hex(from_block) if isinstance(from_block, int) else from_block,
        "toBlock": to_block,
        "address": USDC_ADDRESS,
        "topics": [
            TRANSFER_TOPIC,
            wallet_padded,  # from address (indexed)
            None,           # any to address
        ],
    }])

    # Query transfers TO this wallet (inflows)
    in_logs = rpc_call("eth_getLogs", [{
        "fromBlock": hex(from_block) if isinstance(from_block, int) else from_block,
        "toBlock": to_block,
        "address": USDC_ADDRESS,
        "topics": [
            TRANSFER_TOPIC,
            None,           # any from address
            wallet_padded,  # to address (indexed)
        ],
    }])

    transfers = []
    for direction, logs in [("OUT", out_logs), ("IN", in_logs)]:
        if not isinstance(logs, list):
            continue
        for log in logs:
            topics = log.get("topics", [])
            if len(topics) < 3:
                continue
            sender = "0x" + topics[1][26:]  # strip padding from indexed address
            receiver = "0x" + topics[2][26:]
            value = int(log.get("data", "0x0"), 16) / 1e6  # USDC 6 decimals
            transfers.append({
                "direction": direction,
                "from": sender,
                "to": receiver,
                "value": value,
                "tx_hash": log.get("transactionHash", ""),
                "block": int(log.get("blockNumber", "0x0"), 16),
            })

    return transfers


def get_wallet_first_tx(wallet: str) -> int | None:
    """Get approximate wallet age by finding first transaction block."""
    # Query nonce at current block (only works for EOAs)
    # For approximate age: scan backwards
    current = get_current_block()

    # Binary search for first transaction (simplified)
    # Just check if wallet has any balance/nonce
    for offset in range(0, 1000000, 200000):
        block = max(1, current - offset)
        nonce = rpc_call("eth_getTransactionCount", [wallet, hex(block)])
        if nonce and int(nonce, 16) > 0:
            # Found a block with nonce > 0, narrow search
            for fine in range(offset - 200000, offset, 50000):
                b = max(1, current - fine)
                n = rpc_call("eth_getTransactionCount", [wallet, hex(b)])
                if n and int(n, 16) == 0:
                    return b
            return block

    return None


def trace_from_whales(whale_addresses: list, days: int = 45) -> dict:
    """Trace USDC outflows from known whale wallets to find stealth candidates."""
    current_block = get_current_block()
    blocks_per_day = 43200  # ~2s blocks on Polygon
    from_block = current_block - (days * blocks_per_day)

    candidates = {}

    for i, whale in enumerate(whale_addresses):
        print(f"  Tracing whale {i+1}/{len(whale_addresses)}: {whale[:10]}...", file=sys.stderr)
        transfers = get_usdc_transfers(whale, from_block)

        for tx in transfers:
            if tx["direction"] == "IN":
                continue  # we want OUTFLOWS from whale → stealth wallets
            receiver = tx["to"].lower()
            if receiver in [w.lower() for w in whale_addresses]:
                continue  # skip transfers between known whales

            if receiver not in candidates:
                candidates[receiver] = {
                    "address": receiver,
                    "funding_sources": set(),
                    "total_received": 0.0,
                    "transfer_count": 0,
                    "whale_funders": set(),
                }

            candidates[receiver]["funding_sources"].add(tx["from"].lower())
            candidates[receiver]["total_received"] += tx["value"]
            candidates[receiver]["transfer_count"] += 1
            if whale.lower() in tx["from"].lower() or tx["from"].lower() == whale.lower():
                candidates[receiver]["whale_funders"].add(whale)

        time.sleep(0.3)  # rate limit

    return candidates


def main():
    whales = [
        addr.strip()
        for addr in sys.argv[1:]
        if addr.strip().startswith("0x") and len(addr.strip()) == 42
    ]

    if not whales:
        print("Usage: python3 polygon_rpc.py 0xWHALE1 0xWHALE2 ...")
        print("  Traces USDC outflows from whale wallets to find stealth candidates.")
        print("  Uses direct Polygon RPC — no Polygonscan API key needed.")
        sys.exit(1)

    print(f"◆ Polygon RPC Tracer — {len(whales)} whales", file=sys.stderr)
    current_block = get_current_block()
    print(f"  Current block: {current_block}", file=sys.stderr)

    candidates = trace_from_whales(whales)

    if not candidates:
        print("No candidates found. Whales may not have recent USDC outflows.")
        return

    # Sort by total received
    sorted_candidates = sorted(
        candidates.items(), key=lambda x: x[1]["total_received"], reverse=True
    )

    print(f"\nFound {len(sorted_candidates)} candidates:\n")
    for addr, info in sorted_candidates[:20]:
        whale_count = len(info["whale_funders"])
        print(
            f"  {addr[:12]}... received ${info['total_received']:,.0f} USDC "
            f"from {info['transfer_count']} txs ({whale_count} direct whale funders)"
        )


if __name__ == "__main__":
    main()
