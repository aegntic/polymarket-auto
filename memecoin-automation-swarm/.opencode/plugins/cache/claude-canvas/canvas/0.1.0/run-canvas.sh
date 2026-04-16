#!/bin/bash
# Wrapper script to run canvas with proper environment
cd "$(dirname "$0")"
exec bun run src/cli.ts "$@"
