#!/usr/bin/env bash
set -euo pipefail

FORMAT="${1:-jsonl}"
CHAIN="${2:-all}"

echo "Exporting CloneNet dataset..."
echo "  Format: $FORMAT"
echo "  Chain: $CHAIN"

bun run src/ts/dataset/export.ts --format "$FORMAT" --chain "$CHAIN"
