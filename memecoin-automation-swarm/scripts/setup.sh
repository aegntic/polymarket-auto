#!/usr/bin/env bash
set -euo pipefail

echo "=== MAS Setup ==="

# Copy env if needed
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example — edit with your API keys"
fi

# Start Docker services
echo "Starting Docker services..."
docker compose -f docker/docker-compose.yml up -d

echo "Waiting for services to be healthy..."
sleep 5

# Init ClickHouse schema
echo "Initializing ClickHouse schema..."
docker exec -i memecoin-clickhouse-1 clickhouse-client \
  --queries-file /docker-entrypoint-initdb.d/01-schema.sql 2>/dev/null || true

# Build Rust workspace
echo "Building Rust workspace..."
cargo build --release

# Install JS dependencies
echo "Installing JS dependencies..."
bun install

echo ""
echo "Setup complete. Run 'just dev' to start."
