#!/usr/bin/env python3
"""
PolyAgent Trade Executor — CLOB Trading Engine (v4)
====================================================
Uses py-clob-client-v2 with deposit wallet (POLY_1271) flow.
Routes geo-blocked requests through Tor SOCKS5 proxy.

Usage:
    python3 trade_executor.py --condition-id 0x... --outcome YES --price 0.55 --size 10

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
        SignatureTypeV2,
        ApiCreds,
    )
    from py_clob_client_v2.clob_types import (
        BalanceAllowanceParams,
        OrderPayload,
    )
except ImportError:
    print("ERROR: pip install py-clob-client-v2")
    sys.exit(1)

PUSD_ADDRESS = Web3.to_checksum_address("0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB")

PUSD_ABI = json.loads(
    '[{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"type":"function"}]'
)

RPC_URL = os.environ.get("POLYGON_RPC_URL", "https://polygon-bor-rpc.publicnode.com")
CLOB_API_URL = os.environ.get("CLOB_API_URL", "https://clob.polymarket.com")
CLOB_PROXY_URL = os.environ.get("CLOB_PROXY_URL", "")

RELAYER_URL = "https://relayer-v2.polymarket.com"

TOR_PROXY_ENDPOINTS = {
    "/order",
    "/orders",
    "/cancel",
    "/cancel-all",
    "/cancel-market-orders",
    "/balance-allowance/update",
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
            if method.upper() not in ("POST", "DELETE") or not self._tor:
                return False
            from urllib.parse import urlparse

            return urlparse(url).path in TOR_PROXY_ENDPOINTS

        def request(
            self,
            method,
            url,
            headers=None,
            data=None,
            params=None,
            content=None,
            **kwargs,
        ):
            if content is not None:
                kwargs["data"] = content
            elif isinstance(data, str):
                kwargs["data"] = data
            elif data is not None:
                kwargs["data"] = (
                    json.dumps(data) if isinstance(data, (dict, list)) else data
                )
            if headers:
                kwargs["headers"] = headers
            if params:
                kwargs["params"] = params
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


def derive_deposit_wallet(private_key: str) -> str:
    from py_builder_relayer_client.client import RelayClient
    from py_builder_relayer_client.config import get_contract_config
    from py_builder_relayer_client.client import derive as _derive

    config = get_contract_config(137)
    from web3 import Web3 as _W3

    account = _W3().eth.account.from_key(private_key)
    eoa = account.address
    return _derive(eoa, config.safe_factory)


class TradeExecutor:
    """Autonomous CLOB trade executor using py-clob-client-v2 with deposit wallet."""

    def __init__(self, private_key: str):
        if not private_key or not private_key.startswith("0x"):
            raise ValueError("Invalid private key — must start with 0x")

        self.private_key = private_key
        self.w3 = Web3(Web3.HTTPProvider(RPC_URL))
        self.account = self.w3.eth.account.from_key(private_key)
        self.address = self.account.address

        self.pusd = self.w3.eth.contract(address=PUSD_ADDRESS, abi=PUSD_ABI)

        self.deposit_wallet = self._derive_deposit_wallet()

        for attempt in range(10):
            try:
                temp_clob = V2ClobClient(
                    host=CLOB_API_URL,
                    key=private_key,
                    chain_id=137,
                )
                creds = temp_clob.create_or_derive_api_key()

                self.clob = V2ClobClient(
                    host=CLOB_API_URL,
                    key=private_key,
                    chain_id=137,
                    creds=creds,
                    signature_type=SignatureTypeV2.POLY_1271,
                    funder=self.deposit_wallet,
                )
                self.creds = creds
                break
            except Exception as e:
                if attempt < 9:
                    time.sleep(6)
                else:
                    raise

        self._tick_cache: dict[str, str] = {}
        self._synced_balance = False

    def _derive_deposit_wallet(self) -> str:
        try:
            from py_builder_relayer_client.client import RelayClient
            from py_builder_relayer_client.config import get_contract_config
            from py_builder_relayer_client.client import derive as _derive

            config = get_contract_config(137)
            return _derive(self.address, config.safe_factory)
        except Exception:
            return ""

    def get_balance(self) -> float:
        if self.deposit_wallet:
            balance = self.pusd.functions.balanceOf(
                Web3.to_checksum_address(self.deposit_wallet)
            ).call()
        else:
            balance = self.pusd.functions.balanceOf(self.address).call()
        return balance / 1e6

    def get_allowance(self) -> float:
        return self.get_balance()

    def approve_usdc(self, amount_usdc: float) -> Optional[str]:
        return "0x0000000000000000000000000000000000000000000000000000000000000000"

    def _ensure_balance_synced(self):
        if self._synced_balance:
            return
        try:
            self.clob.update_balance_allowance(
                BalanceAllowanceParams(
                    asset_type="COLLATERAL",
                    signature_type=int(SignatureTypeV2.POLY_1271),
                )
            )
            self._synced_balance = True
        except Exception:
            pass

    def _get_market_info(self, condition_id: str):
        market = self.clob.get_market(condition_id=condition_id)
        if not market:
            raise ValueError(f"Market not found: {condition_id}")
        return market

    def _get_tick_size(self, token_id: str, market: dict = None) -> str:
        if token_id not in self._tick_cache:
            if market and isinstance(market, dict):
                ts = market.get("minimum_tick_size", market.get("tick_size", "0.01"))
                self._tick_cache[token_id] = str(ts)
            else:
                resp = self.clob.get_tick_size(token_id=token_id)
                if isinstance(resp, dict):
                    self._tick_cache[token_id] = str(
                        resp.get("minimum_tick_size", resp.get("tick_size", "0.01"))
                    )
                else:
                    self._tick_cache[token_id] = "0.01"
        return self._tick_cache[token_id]

    def _get_neg_risk(self, token_id: str, market: dict = None) -> bool:
        if market and isinstance(market, dict):
            return market.get("neg_risk", False)
        try:
            resp = self.clob.get_neg_risk(token_id=token_id)
            if isinstance(resp, dict):
                return resp.get("neg_risk", False)
        except Exception:
            pass
        return False

    def _get_token_id(
        self, condition_id: str, outcome: str, market: dict = None
    ) -> str:
        if not market:
            market = self._get_market_info(condition_id)
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
            market = self._get_market_info(condition_id)
            token_id = self._get_token_id(condition_id, outcome, market)
            min_size = int(market.get("minimum_order_size", 5))
            size_shares = max(
                min_size, int(size_usdc / price) if price > 0 else int(size_usdc)
            )
            price = max(0.01, price)
            tick_size = self._get_tick_size(token_id, market)
            neg_risk = self._get_neg_risk(token_id, market)

            self._ensure_balance_synced()

            resp = self.clob.create_and_post_order(
                order_args=V2OrderArgs(
                    token_id=token_id,
                    price=price,
                    size=size_shares,
                    side=Side.BUY,
                ),
                options=PartialCreateOrderOptions(
                    tick_size=tick_size,
                    neg_risk=neg_risk,
                ),
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
                    resp.get("error", resp.get("errorMsg", "order rejected"))
                    if resp
                    else "no response"
                )
                return {"success": False, "error": error_msg}

        except Exception as e:
            return {"success": False, "error": str(e)}

    def cancel_order(self, order_id: str) -> dict:
        try:
            resp = self.clob.cancel_order(OrderPayload(orderID=order_id))
            canceled = resp.get("canceled", [])
            return {"success": len(canceled) > 0, "details": resp}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def cancel_all(self) -> dict:
        try:
            resp = self.clob.cancel_all()
            return {"success": True, "details": resp}
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
    print(f"Deposit Wallet: {executor.deposit_wallet}")
    print(f"pUSD Balance: ${executor.get_balance():.2f}")
    print(f"Proxy: {CLOB_PROXY_URL or 'none'}")

    print(f"\nPlacing {args.outcome} order on {args.condition_id[:16]}...")
    result = executor.place_order(
        args.condition_id, args.outcome, args.price, args.size
    )
    print(json.dumps(result, indent=2))
