FROM python:3.11-slim

LABEL org.opencontainers.image.description="StealthTrace multi-agent scanner instance"

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# App
WORKDIR /app
COPY stealthscan.py /app/
COPY stealthtrace.py /app/
COPY stealthwatch.py /app/
COPY requirements.txt /app/

RUN pip install --no-cache-dir -r requirements.txt

# Health check
HEALTHCHECK --interval=300s --timeout=15s --retries=2 \
    CMD python3 -c "import stealthscan; print('ok')" || exit 1

# Default: run stealthwatch in continuous mode
# Each scan polls every 15min for new edge signals
CMD ["python3", "stealthwatch.py"]
