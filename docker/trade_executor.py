#!/usr/bin/env python3
"""
PolyAgent Trade Executor — CLOB Trading Engine
===============================================
Executes trades on Polymarket CLOB via Polygon RPC + web3.py.
Uses a private key wallet — no browser needed. Full autonomy.

Contracts (Polygon mainnet):
  USDC:              0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
  CTF Exchange:      0x4D97DCd97eC945f40cF65F87097ACe5EA0476045
  NegRisk CLOB:      0xC5d563A36AE78145C45a50134d48A1215220f80a

Usage:
    python3 trade_executor.py --private-key 0x... --market 0xCONDITION_ID --outcome YES --price 0.55 --size 10

Env vars:
    POLYGON_RPC_URL        — Polygon RPC endpoint (default: publicnode)
    POLYMARKET_PRIVATE_KEY — wallet private key
"""

import json
import os
import sys
import time
from typing import Optional

try:
    from web3 import Web3
except ImportError:
    print("ERROR: pip install web3")
    sys.exit(1)

# ============================================================================
# Contracts
# ============================================================================

USDC_ADDRESS = Web3.to_checksum_address("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174")
CTF_ADDRESS = Web3.to_checksum_address("0x4D97DCd97eC945f40cF65F87097ACe5EA0476045")
CLOB_ADDRESS = Web3.to_checksum_address("0xC5d563A36AE78145C45a50134d48A1215220f80a")

USDC_ABI = json.loads('[{"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"remaining","type":"uint256"}],"type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"success","type":"bool"}],"type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"type":"function"}]')

CLOB_ABI = json.loads('[{"inputs":[{"internalType":"uint256","name":"marketId","type":"uint256"},{"internalType":"uint8","name":"outcome","type":"uint8"},{"internalType":"uint256","name":"price","type":"uint256"},{"internalType":"uint256","name":"size","type":"uint256"}],"name":"createOrder","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"orderId","type":"uint256"}],"name":"cancelOrder","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"orderId","type":"uint256"}],"name":"getOrder","outputs":[{"components":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"address","name":"trader","type":"address"},{"internalType":"uint256","name":"marketId","type":"uint256"},{"internalType":"uint8","name":"outcome","type":"uint8"},{"internalType":"uint256","name":"price","type":"uint256"},{"internalType":"uint256","name":"size","type":"uint256"},{"internalType":"uint8","name":"status","type":"uint8"}],"internalType":"struct Order","name":"","type":"tuple"}],"stateMutability":"view","type":"function"}]')

RPC_URL = os.environ.get("POLYGON_RPC_URL", "https://polygon-bor-rpc.publicnode.com")


class TradeExecutor:
    """Autonomous CLOB trade executor with web3.py."""

    def __init__(self, private_key: str):
        self.w3 = Web3(Web3.HTTPProvider(RPC_URL))
        self.account = self.w3.eth.account.from_key(private_key)
        self.address = self.account.address

        # Contract instances
        self.usdc = self.w3.eth.contract(address=USDC_ADDRESS, abi=USDC_ABI)
        self.clob = self.w3.eth.contract(address=CLOB_ADDRESS, abi=CLOB_ABI)

    # ------------------------------------------------------------------
    # Wallet
    # ------------------------------------------------------------------

    def get_balance(self) -> float:
        """Get USDC balance."""
        balance = self.usdc.functions.balanceOf(self.address).call()
        return balance / 1e6

    def get_allowance(self) -> float:
        """Get USDC allowance for CLOB."""
        allowance = self.usdc.functions.allowance(self.address, CLOB_ADDRESS).call()
        return allowance / 1e6

    def approve_usdc(self, amount_usdc: float) -> Optional[str]:
        """Approve USDC spending for CLOB. Returns tx hash or None."""
        amount_wei = int(amount_usdc * 1e6)
        tx = self.usdc.functions.approve(CLOB_ADDRESS, amount_wei).build_transaction({
            "from": self.address,
            "nonce": self.w3.eth.get_transaction_count(self.address),
            "gas": 100000,
            "gasPrice": self.w3.eth.gas_price,
        })
        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return tx_hash.hex() if receipt.status == 1 else None

    # ------------------------------------------------------------------
    # Trading
    # ------------------------------------------------------------------

    def place_order(
        self,
        condition_id: str,
        outcome: str,  # "YES" or "NO"
        price: float,  # 0.01 to 0.99
        size_usdc: float,  # amount in USDC
    ) -> dict:
        """
        Place a limit order on Polymarket CLOB.
        
        Returns: {"success": True/False, "tx_hash": "0x...", "error": "..."}
        """
        if not self.w3.is_connected():
            return {"success": False, "error": "RPC not connected"}

        try:
            # Convert condition_id to uint256 marketId
            market_id = int(condition_id, 16) if condition_id.startswith("0x") else int(condition_id)

            # Convert to wei (6 decimals for USDC)
            price_wei = int(price * 1e6)
            size_wei = int(size_usdc * 1e6)
            outcome_num = 1 if outcome.upper() == "YES" else 0

            # Check allowance
            allowance = self.get_allowance()
            if allowance < size_usdc:
                approve_tx = self.approve_usdc(size_usdc * 2)  # approve double for gas
                if not approve_tx:
                    return {"success": False, "error": "USDC approval failed"}

            # Build and send transaction
            tx = self.clob.functions.createOrder(
                market_id, outcome_num, price_wei, size_wei
            ).build_transaction({
                "from": self.address,
                "nonce": self.w3.eth.get_transaction_count(self.address),
                "gas": 500000,
                "gasPrice": self.w3.eth.gas_price,
            })

            signed = self.account.sign_transaction(tx)
            tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

            return {
                "success": receipt.status == 1,
                "tx_hash": tx_hash.hex(),
                "block": receipt.blockNumber,
                "gas_used": receipt.gasUsed,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def buy_yes(self, condition_id: str, price: float, size: float) -> dict:
        return self.place_order(condition_id, "YES", price, size)

    def buy_no(self, condition_id: str, price: float, size: float) -> dict:
        return self.place_order(condition_id, "NO", price, size)


# ============================================================================
# CLI
# ============================================================================

def main():
    import argparse
    parser = argparse.ArgumentParser(description="PolyAgent CLOB Trade Executor")
    parser.add_argument("--private-key", help="Wallet private key (0x...)")
    parser.add_argument("--market", required=True, help="Condition ID (0x...)")
    parser.add_argument("--outcome", required=True, choices=["YES", "NO"])
    parser.add_argument("--price", type=float, required=True, help="Price 0.01-0.99")
    parser.add_argument("--size", type=float, required=True, help="Size in USDC")
    parser.add_argument("--dry-run", action="store_true", help="Simulate only")
    args = parser.parse_args()

    private_key = args.private_key or os.environ.get("POLYMARKET_PRIVATE_KEY", "")
    if not private_key:
        print("ERROR: Set POLYMARKET_PRIVATE_KEY or pass --private-key")
        sys.exit(1)

    executor = TradeExecutor(private_key)
    balance = executor.get_balance()
    print(f"Wallet: {executor.address}")
    print(f"USDC Balance: ${balance:.2f}")

    if args.dry_run:
        print(f"\n[DRY RUN] Would place order:")
        print(f"  Market: {args.market}")
        print(f"  Outcome: {args.outcome}")
        print(f"  Price: {args.price}")
        print(f"  Size: ${args.size:.2f}")
        return

    print(f"\n▶ Placing {args.outcome} order at {args.price} for ${args.size:.2f}...")
    result = executor.place_order(args.market, args.outcome, args.price, args.size)

    if result["success"]:
        print(f"✓ Trade executed!")
        print(f"  TX: {result['tx_hash']}")
        print(f"  Block: {result['block']}")
        print(f"  Gas: {result['gas_used']}")
    else:
        print(f"✗ Trade failed: {result.get('error', 'unknown')}")


if __name__ == "__main__":
    main()
