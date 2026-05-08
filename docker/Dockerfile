FROM python:3.11-slim

LABEL org.opencontainers.image.description="PolyAgent Swarm Trading Node"

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# App
WORKDIR /app
COPY stealthscan.py /app/
COPY stealthtrace.py /app/
COPY stealthwatch.py /app/
COPY swarm_agent.py /app/
COPY trade_executor.py /app/
COPY requirements.txt /app/

RUN pip install --no-cache-dir -r requirements.txt

# Health check
HEALTHCHECK --interval=300s --timeout=15s --retries=2 \
    CMD python3 -c "import swarm_agent; print('ok')" || exit 1

# Default: swarm agent in continuous trading mode
CMD ["python3", "swarm_agent.py"]
