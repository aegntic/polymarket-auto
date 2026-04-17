#!/bin/bash
KEYPAIR_PATH=".solana-deployer-keypair.json"
echo "Mining devnet SOL for keypair $KEYPAIR_PATH"
# Use a timeout so we don't mine forever if it succeeds or gets stuck
timeout 120 /home/ae/.cargo/bin/devnet-pow mine -k $KEYPAIR_PATH -d 2 --reward 0.05 --no-infer -t 1000000
