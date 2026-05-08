#!/usr/bin/env bash
# StealthTrace Multi-Agent Launcher
# Starts all Docker instances with staggered timing to avoid rate limits.
set -e

echo "◆ StealthTrace Multi-Agent Deployment"
echo ""

# Check deps
command -v docker >/dev/null 2>&1 || { echo "ERROR: docker not installed"; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "ERROR: docker compose not available"; exit 1; }

# Check API keys
if [ -z "$POLYGONSCAN_API_KEY" ]; then
    echo "⚠ POLYGONSCAN_API_KEY not set — wallet tracing disabled"
    echo "  Register: https://polygonscan.com/register"
fi

# Build
echo "→ Building images..."
docker compose build --quiet

# Launch with staggered starts (5s gap prevents rate-limit pileup)
echo "→ Launching agents..."
docker compose up -d sports
sleep 5
docker compose up -d geopolitics
sleep 5
docker compose up -d tech
sleep 5
docker compose up -d weather
sleep 3
docker compose up -d orchestrator

echo ""
echo "✓ All agents deployed"
echo ""
echo "  Status:    docker compose ps"
echo "  Logs:      docker compose logs -f [sports|geopolitics|tech|weather]"
echo "  Metrics:   curl http://localhost:9090/metrics"
echo "  Killswitch: curl -X POST http://localhost:9091/killswitch"
echo "  Stop:      docker compose down"
