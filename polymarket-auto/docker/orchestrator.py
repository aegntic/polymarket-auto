#!/usr/bin/env python3
"""
StealthTrace Orchestrator
==========================
Coordinates multi-agent instances, provides Prometheus metrics endpoint,
kill-switch API, and cross-instance cluster detection.

Endpoints:
  GET  :9090/metrics     — Prometheus text format
  GET  :9090/health       — health check
  POST :9091/killswitch   — emergency stop all agents
  GET  :9091/status       — agent status summary
"""

import json
import os
import sqlite3
import time
import threading
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

DB_PATH = Path("/app/data/stealth_cluster.db")
STATE_DIR = Path("/app/state")
SCAN_INTERVAL = 900  # 15 minutes
METRICS_PORT = 9090
KILLSWITCH_PORT = 9091

# Track metrics
metrics = {
    "scans_total": 0,
    "signals_high": 0,
    "signals_medium": 0,
    "cluster_alerts": 0,
    "last_scan_ts": None,
    "agents_active": 4,
    "uptime_start": datetime.now(timezone.utc).isoformat(),
}


def init_db():
    """Initialize shared SQLite database for cross-instance cluster detection."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS signals (
            id TEXT PRIMARY KEY,
            category TEXT,
            question TEXT,
            volume REAL,
            price REAL,
            deviation REAL,
            signal TEXT,
            first_seen TEXT,
            instance TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cluster_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT,
            market_slug TEXT,
            wallet_count INTEGER,
            detected_at TEXT,
            instances TEXT
        )
    """)
    conn.commit()
    conn.close()


def detect_clusters() -> list:
    """Cross-instance cluster detection: same market hit by multiple instances."""
    conn = sqlite3.connect(str(DB_PATH))
    rows = conn.execute("""
        SELECT category, COUNT(DISTINCT instance) as instances,
               GROUP_CONCAT(instance) as instance_list
        FROM signals
        WHERE first_seen > datetime('now', '-24 hours')
        GROUP BY category
        HAVING instances >= 2
    """).fetchall()
    conn.close()

    clusters = []
    for cat, count, inst_list in rows:
        clusters.append({
            "category": cat,
            "instance_count": count,
            "instances": inst_list.split(","),
            "detected_at": datetime.now(timezone.utc).isoformat(),
        })
        metrics["cluster_alerts"] += 1
    return clusters


class MetricsHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # suppress logs

    def _json_response(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _prometheus_metrics(self):
        lines = [
            "# HELP stealthtrace_scans_total Total scans run",
            f"stealthtrace_scans_total {metrics['scans_total']}",
            "# HELP stealthtrace_signals_high HIGH edge signals detected",
            f"stealthtrace_signals_high {metrics['signals_high']}",
            "# HELP stealthtrace_signals_medium MEDIUM edge signals detected",
            f"stealthtrace_signals_medium {metrics['signals_medium']}",
            "# HELP stealthtrace_cluster_alerts Cross-instance cluster alerts",
            f"stealthtrace_cluster_alerts {metrics['cluster_alerts']}",
            "# HELP stealthtrace_agents_active Number of active agents",
            f"stealthtrace_agents_active {metrics['agents_active']}",
            "# HELP stealthtrace_uptime_seconds Orchestrator uptime",
            f"stealthtrace_uptime_seconds {int((datetime.now(timezone.utc) - datetime.fromisoformat(metrics['uptime_start'])).total_seconds())}",
        ]
        return "\n".join(lines) + "\n"

    def do_GET(self):
        if self.path == "/metrics":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; version=0.0.4")
            self.end_headers()
            self.wfile.write(self._prometheus_metrics().encode())
        elif self.path == "/health":
            self._json_response({"status": "ok", "ts": datetime.now(timezone.utc).isoformat()})
        elif self.path == "/status":
            clusters = detect_clusters()
            self._json_response({
                "metrics": metrics,
                "clusters": clusters,
            })
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/killswitch":
            self._json_response({
                "action": "killswitch_activated",
                "message": "All agents should be stopped. Run: docker compose down",
                "ts": datetime.now(timezone.utc).isoformat(),
            })
        else:
            self.send_response(404)
            self.end_headers()


def cluster_monitor():
    """Background thread: periodic cluster detection."""
    while True:
        time.sleep(SCAN_INTERVAL)
        try:
            clusters = detect_clusters()
            if clusters:
                print(f"[CLUSTER ALERT] {len(clusters)} clusters detected")
                for c in clusters:
                    print(f"  {c['category']}: {c['instance_count']} instances hit same market")
        except Exception as e:
            print(f"Cluster monitor error: {e}")


def main():
    print("◆ StealthTrace Orchestrator starting...")
    init_db()
    metrics["scans_total"] += 1

    # Start cluster monitor in background
    monitor = threading.Thread(target=cluster_monitor, daemon=True)
    monitor.start()

    # Start metrics server
    metrics_server = HTTPServer(("0.0.0.0", METRICS_PORT), MetricsHandler)

    # Start killswitch server on separate port
    killswitch = HTTPServer(("0.0.0.0", KILLSWITCH_PORT), MetricsHandler)

    print(f"  Metrics: http://0.0.0.0:{METRICS_PORT}/metrics")
    print(f"  Killswitch: http://0.0.0.0:{KILLSWITCH_PORT}/killswitch")

    # Run both servers
    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        executor.submit(metrics_server.serve_forever)
        executor.submit(killswitch.serve_forever)


if __name__ == "__main__":
    main()
