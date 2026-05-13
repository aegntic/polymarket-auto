#!/usr/bin/env python3
"""
CLOB Relay Proxy — bypasses Polymarket geo-block using cloakbrowser.
Listens on 127.0.0.1:8877 and relays POST requests through stealth Chromium.

Usage:
    python3 clob_relay.py                    # foreground
    python3 clob_relay.py --port 8877        # custom port
"""

import json
import sys
import time
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler

from cloakbrowser import launch

BROWSER_ARGS = [
    "--ignore-certificate-errors",
    "--disable-web-security",
    "--host-resolver-rules=MAP gamma-api.polymarket.com 104.18.33.93,MAP clob.polymarket.com 104.18.34.205",
]

CLOB_ORIGIN = "https://clob.polymarket.com"

_browser = None
_page = None
_lock = threading.Lock()


def _ensure_browser():
    global _browser, _page
    if _browser and _page:
        try:
            _page.evaluate("1+1")
            return _page
        except Exception:
            pass

    print("[relay] Launching cloakbrowser...")
    _browser = launch(headless=True, humanize=True, args=BROWSER_ARGS)
    _page = _browser.new_page()

    print("[relay] Warming up — loading CLOB origin...")
    _page.goto(
        f"{CLOB_ORIGIN}/markets?limit=1",
        timeout=20000,
        wait_until="domcontentloaded",
    )
    time.sleep(2)
    print("[relay] Browser ready.")
    return _page


def _relay_post(path: str, headers: dict, body: bytes) -> dict:
    page = _ensure_browser()
    body_text = body.decode("utf-8", errors="replace")

    js = """
    async (args) => {
        try {
            const resp = await fetch(args.url, {
                method: 'POST',
                headers: args.headers,
                body: args.body,
                credentials: 'include',
            });
            const text = await resp.text();
            let jsonData = null;
            try { jsonData = JSON.parse(text); } catch(e) {}
            return {
                status: resp.status,
                headers: Object.fromEntries(resp.headers.entries()),
                body: text,
                json: jsonData,
            };
        } catch (e) {
            return { status: 0, body: e.message, json: null };
        }
    }
    """

    fetch_headers = {"Content-Type": "application/json"}
    for key in [
        "POLY-ADDRESS",
        "POLY-SIGNATURE",
        "POLY-TIMESTAMP",
        "POLY-NONCE",
        "POLY-API-KEY",
    ]:
        if key in headers:
            fetch_headers[key] = headers[key]
        elif key.lower() in {k.lower(): k for k in headers}:
            fetch_headers[key] = headers[key.lower()]

    result = page.evaluate(
        js,
        {"url": f"{CLOB_ORIGIN}{path}", "headers": fetch_headers, "body": body_text},
    )
    return result


class RelayHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length else b""

        incoming_headers = {
            k: v
            for k, v in self.headers.items()
            if k.startswith("Poly-") or k.lower().startswith("poly-")
        }

        with _lock:
            try:
                result = _relay_post(self.path, incoming_headers, body)
            except Exception as e:
                print(f"[relay] Error: {e}")
                self.send_response(502)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
                return

        status = result.get("status", 502)
        resp_body = result.get("body", "{}")

        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Relayed-Via", "cloakbrowser")
        self.end_headers()
        self.wfile.write(
            resp_body.encode()
            if isinstance(resp_body, str)
            else json.dumps(resp_body).encode()
        )

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"status": "ok", "relay": "cloakbrowser"}).encode())

    def log_message(self, format, *args):
        print(f"[relay] {args[0]}" if args else f"[relay] {format}")


def main():
    port = int(sys.argv[sys.argv.index("--port") + 1]) if "--port" in sys.argv else 8877

    _ensure_browser()

    server = HTTPServer(("127.0.0.1", port), RelayHandler)
    print(f"[relay] Listening on 127.0.0.1:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[relay] Shutting down.")
        if _browser:
            _browser.close()
        server.server_close()


if __name__ == "__main__":
    main()
