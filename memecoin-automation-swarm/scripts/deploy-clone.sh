#!/usr/bin/env bash
set -euo pipefail

CHAIN="${1:-solana}"
STRATEGY="${2:-substitution}"
NETWORK="${3:-devnet}"

echo "Deploying clone token..."
echo "  Chain: $CHAIN"
echo "  Strategy: $STRATEGY"
echo "  Network: $NETWORK"

cargo run -p mint -- --chain "$CHAIN" --strategy "$STRATEGY" --network "$NETWORK"
