#!/usr/bin/env python3
"""
PolyAgent Trade Executor — CLOB Trading Engine (v3)
====================================================
Uses py-clob-client-v2 (official Polymarket V2 SDK).
Routes order POSTs through Tor SOCKS5 to bypass Cloudflare geo-block.

Usage:
    python3 trade_executor.py --private-key 0x... --condition-id 0x... --outcome YES --price 0.55 --size 10

Env vars:
    POLYGON_RPC_URL        — Polygon RPC endpoint
    POLYMARKET_PRIVATE_KEY — wallet private key
    CLOB_PROXY_URL         — SOCKS5 proxy for geo-blocked endpoints (e.g. socks5://172.17.0.1:9050)
"""

import json
import os
import sys
import socket
import time
from typing import Optional

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
    from py_clob_client_v2 import (
        ClobClient as V2ClobClient,
        OrderArgs as V2OrderArgs,
        Side,
        OrderType,
        PartialCreateOrderOptions,
    )
except ImportError:
    print("ERROR: pip install py-clob-client-v2")
    sys.exit(1)

USDC_ADDRESS = Web3.to_checksum_address("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359")

USDC_ABI = json.loads(
    '[{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"type":"function"}]'
)

RPC_URL = os.environ.get("POLYGON_RPC_URL", "https://polygon-bor-rpc.publicnode.com")
CLOB_API_URL = os.environ.get("CLOB_API_URL", "https://clob.polymarket.com")
CLOB_PROXY_URL = os.environ.get("CLOB_PROXY_URL", "")

TOR_PROXY_ENDPOINTS = {
    "/order",
    "/cancel-order",
    "/cancel-all",
    "/cancel-orders-by-market",
    "/post-orders",
}

try:
    from py_clob_client_v2.http_helpers import helpers as _helpers
    from curl_cffi import requests as cffi_requests

    class _CffiAdapter:
        def __init__(self):
            self._direct = cffi_requests.Session(impersonate="chrome")
            self._tor = None
            if CLOB_PROXY_URL:
                self._tor = cffi_requests.Session(impersonate="chrome")
                self._tor.proxies = {"https": CLOB_PROXY_URL, "http": CLOB_PROXY_URL}

        def _needs_tor(self, method, url):
            if method.upper() != "POST" or not self._tor:
                return False
            from urllib.parse import urlparse

            return urlparse(url).path in TOR_PROXY_ENDPOINTS

        def request(self, method, url, **kwargs):
            if "content" in kwargs:
                kwargs["data"] = kwargs.pop("content")
            session = self._tor if self._needs_tor(method, url) else self._direct
            return session.request(method, url, **kwargs)

        def get(self, url, **kwargs):
            return self.request("GET", url, **kwargs)

        def post(self, url, **kwargs):
            return self.request("POST", url, **kwargs)

        def put(self, url, **kwargs):
            return self.request("PUT", url, **kwargs)

        def delete(self, url, **kwargs):
            return self.request("DELETE", url, **kwargs)

    _adapter = _CffiAdapter()
    _helpers._http_client = _adapter
except ImportError:
    pass


class TradeExecutor:
    """Autonomous CLOB trade executor using py-clob-client-v2."""

    def __init__(self, private_key: str):
        if not private_key or not private_key.startswith("0x"):
            raise ValueError("Invalid private key — must start with 0x")

        self.private_key = private_key
        self.w3 = Web3(Web3.HTTPProvider(RPC_URL))
        self.account = self.w3.eth.account.from_key(private_key)
        self.address = self.account.address

        self.usdc = self.w3.eth.contract(address=USDC_ADDRESS, abi=USDC_ABI)

        for attempt in range(10):
            try:
                self.clob = V2ClobClient(
                    host=CLOB_API_URL,
                    key=private_key,
                    chain_id=137,
                )
                creds = self.clob.create_or_derive_api_key()
                self.clob = V2ClobClient(
                    host=CLOB_API_URL,
                    key=private_key,
                    chain_id=137,
                    creds=creds,
                )
                break
            except Exception as e:
                if attempt < 9:
                    time.sleep(6)
                else:
                    raise

        self._tick_cache: dict[str, str] = {}

    def get_balance(self) -> float:
        balance = self.usdc.functions.balanceOf(self.address).call()
        return balance / 1e6

    def get_allowance(self) -> float:
        return self.get_balance()

    def approve_usdc(self, amount_usdc: float) -> Optional[str]:
        return "0x0000000000000000000000000000000000000000000000000000000000000000"

    def _get_tick_size(self, token_id: str) -> str:
        if token_id not in self._tick_cache:
            resp = self.clob.get_tick_size(token_id=token_id)
            if isinstance(resp, dict):
                self._tick_cache[token_id] = str(resp.get("tick_size", "0.01"))
            else:
                self._tick_cache[token_id] = "0.01"
        return self._tick_cache[token_id]

    def _get_token_id(self, condition_id: str, outcome: str) -> str:
        market = self.clob.get_market(condition_id=condition_id)
        if not market:
            raise ValueError(f"Market not found: {condition_id}")
        outcome_label = "Yes" if outcome.upper() == "YES" else "No"
        tokens = market.get("tokens", []) if isinstance(market, dict) else []
        token = next(
            (t for t in tokens if t.get("outcome") == outcome_label),
            None,
        )
        if not token:
            raise ValueError(
                f"Token not found for {outcome_label} in {condition_id[:16]}..."
            )
        return token["token_id"]

    def place_order(
        self,
        condition_id: str,
        outcome: str,
        price: float,
        size_usdc: float,
    ) -> dict:
        if not self.w3.is_connected():
            return {"success": False, "error": "RPC not connected"}

        try:
            token_id = self._get_token_id(condition_id, outcome)
            size_shares = max(
                1, int(size_usdc / price) if price > 0 else int(size_usdc)
            )
            price = max(0.01, price)
            tick_size = self._get_tick_size(token_id)

            resp = self.clob.create_and_post_order(
                order_args=V2OrderArgs(
                    token_id=token_id,
                    price=price,
                    size=size_shares,
                    side=Side.BUY,
                ),
                options=PartialCreateOrderOptions(tick_size=tick_size),
                order_type=OrderType.GTC,
            )

            if resp and (resp.get("success") or resp.get("orderID")):
                return {
                    "success": True,
                    "tx_hash": resp.get("transactionHash", "clob_api"),
                    "order_id": resp.get("orderID", ""),
                    "details": f"BUY {size_shares} @ {price} | {outcome}",
                }
            else:
                error_msg = (
                    resp.get("error", "order rejected") if resp else "no response"
                )
                return {"success": False, "error": error_msg}

        except Exception as e:
            return {"success": False, "error": str(e)}

    def buy_yes(self, condition_id: str, price: float, size: float) -> dict:
        return self.place_order(condition_id, "YES", price, size)

    def buy_no(self, condition_id: str, price: float, size: float) -> dict:
        return self.place_order(condition_id, "NO", price, size)


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
    result = executor.place_order(
        args.condition_id, args.outcome, args.price, args.size
    )
    print(json.dumps(result, indent=2))
