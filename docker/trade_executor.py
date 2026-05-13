#!/usr/bin/env python3
"""
PolyAgent Trade Executor — CLOB Trading Engine (v2)
====================================================
Executes trades on Polymarket CLOB via the official py-clob-client SDK.
Uses EIP-712 signed orders through the REST API — no direct contract calls.

Contracts (Polygon mainnet):
  USDC (native):      0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
  CTF Exchange:       0x4D97DCd97eC945f40cF65F87097ACe5EA0476045
  NegRisk CLOB:       0xC5d563A36AE78145C45a50134d48A1215220f80a

Usage:
    python3 trade_executor.py --private-key 0x... --condition-id 0x... --outcome YES --price 0.55 --size 10

Env vars:
    POLYGON_RPC_URL        — Polygon RPC endpoint
    POLYMARKET_PRIVATE_KEY — wallet private key
    CLOB_PROXY_URL         — SOCKS5 proxy (e.g. socks5://localhost:9051 for Tor)
"""
import json
import os
import sys
import socket
import time
from typing import Optional

# ============================================================================
# DNS Hijack Bypass (ACMA / Australian ISP)
# ============================================================================
DNS_OVERRIDES = {
    "clob.polymarket.com": "104.18.34.205",
    "gamma-api.polymarket.com": "104.18.34.205",
}

_original_getaddrinfo = socket.getaddrinfo

def _patched_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    if host in DNS_OVERRIDES:
        host = DNS_OVERRIDES[host]
    return _original_getaddrinfo(host, port, family, type, proto, flags)

socket.getaddrinfo = _patched_getaddrinfo

try:
    from web3 import Web3
except ImportError:
    print("ERROR: pip install web3")
    sys.exit(1)

try:
    from py_clob_client.client import ClobClient
    from py_clob_client.clob_types import OrderArgs
    from py_clob_client.constants import POLYGON
    from py_clob_client.order_builder.constants import BUY, SELL
except ImportError:
    print("ERROR: pip install py-clob-client")
    sys.exit(1)

# ============================================================================
# Contracts
# ============================================================================
USDC_ADDRESS = Web3.to_checksum_address("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359")

USDC_ABI = json.loads('[{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"type":"function"}]')

RPC_URL = os.environ.get("POLYGON_RPC_URL", "https://polygon-bor-rpc.publicnode.com")
CLOB_API_URL = os.environ.get("CLOB_API_URL", "https://clob.polymarket.com")
CLOB_PROXY_URL = os.environ.get("CLOB_PROXY_URL", "")

# Patch py_clob_client's httpx client to use SOCKS5 proxy (only for CLOB API)
if CLOB_PROXY_URL:
    from py_clob_client.http_helpers import helpers as _helpers
    import httpx
    _helpers._http_client = httpx.Client(proxy=CLOB_PROXY_URL, timeout=60)


class TradeExecutor:
    """Autonomous CLOB trade executor using py-clob-client SDK."""

    def __init__(self, private_key: str):
        if not private_key or not private_key.startswith("0x"):
            raise ValueError("Invalid private key — must start with 0x")

        self.private_key = private_key
        self.w3 = Web3(Web3.HTTPProvider(RPC_URL))
        self.account = self.w3.eth.account.from_key(private_key)
        self.address = self.account.address

        # USDC contract for balance queries
        self.usdc = self.w3.eth.contract(address=USDC_ADDRESS, abi=USDC_ABI)

        # CLOB client — with retry for Tor bootstrap
        for attempt in range(10):
            try:
                self.clob = ClobClient(
                    host=CLOB_API_URL,
                    key=private_key,
                    chain_id=POLYGON,
                    signature_type=0,
                    funder=self.address,
                )
                self.clob.set_api_creds(self.clob.create_or_derive_api_creds())
                break
            except Exception as e:
                if attempt < 9:
                    time.sleep(6)
                else:
                    raise

        self._market_cache: dict[str, dict] = {}

    # ------------------------------------------------------------------
    # Balance
    # ------------------------------------------------------------------
    def get_balance(self) -> float:
        balance = self.usdc.functions.balanceOf(self.address).call()
        return balance / 1e6

    def get_allowance(self) -> float:
        return self.get_balance()

    def approve_usdc(self, amount_usdc: float) -> Optional[str]:
        return "0x0000000000000000000000000000000000000000000000000000000000000000"

    # ------------------------------------------------------------------
    # Market data
    # ------------------------------------------------------------------
    def _get_token_id(self, condition_id: str, outcome: str) -> str:
        if condition_id not in self._market_cache:
            market = self.clob.get_market(condition_id=condition_id)
            if not market:
                raise ValueError(f"Market not found: {condition_id}")
            self._market_cache[condition_id] = market

        market = self._market_cache[condition_id]
        outcome_label = "Yes" if outcome.upper() == "YES" else "No"
        token = next(
            (t for t in market.get("tokens", []) if t.get("outcome") == outcome_label),
            None,
        )
        if not token:
            raise ValueError(f"Token not found for {outcome_label} in {condition_id[:16]}...")
        return token["token_id"]

    # ------------------------------------------------------------------
    # Trading
    # ------------------------------------------------------------------
    def place_order(
        self,
        condition_id: str,
        outcome: str,
        price: float,
        size_usdc: float,
    ) -> dict:
        """Place a limit order on Polymarket CLOB. Returns {success, tx_hash, error}."""
        if not self.w3.is_connected():
            return {"success": False, "error": "RPC not connected"}

        try:
            token_id = self._get_token_id(condition_id, outcome)
            size_shares = max(1, int(size_usdc / price) if price > 0 else int(size_usdc))
            price = max(0.01, price)

            order_args = OrderArgs(
                price=price,
                size=size_shares,
                side=BUY,
                token_id=token_id,
            )
            signed = self.clob.create_order(order_args)
            resp = self.clob.post_order(signed)

            if resp and resp.get("success"):
                return {
                    "success": True,
                    "tx_hash": resp.get("transactionHash", "clob_api"),
                    "order_id": resp.get("orderID", ""),
                    "details": f"BUY {size_shares} @ {price} | {outcome}",
                }
            else:
                error_msg = resp.get("error", "order rejected") if resp else "no response"
                return {"success": False, "error": error_msg}

        except Exception as e:
            return {"success": False, "error": str(e)}

    def buy_yes(self, condition_id: str, price: float, size: float) -> dict:
        return self.place_order(condition_id, "YES", price, size)

    def buy_no(self, condition_id: str, price: float, size: float) -> dict:
        return self.place_order(condition_id, "NO", price, size)


# ============================================================================
# CLI
# ============================================================================
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="PolyAgent Trade Executor")
    parser.add_argument("--private-key", help="Wallet private key")
    parser.add_argument("--condition-id", required=True, help="Market condition ID")
    parser.add_argument("--outcome", default="YES", choices=["YES", "NO"])
    parser.add_argument("--price", type=float, required=True)
    parser.add_argument("--size", type=float, required=True, help="USDC amount")
    args = parser.parse_args()

    pk = args.private_key or os.environ.get("POLYMARKET_PRIVATE_KEY", "")
    if not pk:
        print("ERROR: --private-key or POLYMARKET_PRIVATE_KEY required")
        sys.exit(1)

    executor = TradeExecutor(pk)
    print(f"Wallet: {executor.address}")
    print(f"USDC Balance: ${executor.get_balance():.2f}")
    print(f"Proxy: {CLOB_PROXY_URL or 'none'}")

    print(f"\nPlacing {args.outcome} order on {args.condition_id[:16]}...")
    result = executor.place_order(args.condition_id, args.outcome, args.price, args.size)
    print(json.dumps(result, indent=2))
