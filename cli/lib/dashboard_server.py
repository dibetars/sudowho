#!/usr/bin/env python3
"""
sudowho dashboard — a tiny local-only web UI.

Runs a stdlib HTTP server bound to 127.0.0.1, serves the static dashboard
assets, and exposes a small JSON API that wraps core.py. No data ever
leaves your machine: every button in the UI just calls a function that
was already part of the CLI.
"""
from __future__ import annotations

import json
import sys
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, str(Path(__file__).parent))
import core  # noqa: E402

ASSETS_DIR = Path(__file__).parent.parent / "dashboard"


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # quieter default logging
        pass

    def _json(self, payload, status=200):
        body = json.dumps(payload, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1")
        self.end_headers()
        self.wfile.write(body)

    def _static(self, path: str):
        if path == "/":
            path = "/index.html"
        file_path = (ASSETS_DIR / path.lstrip("/")).resolve()
        if ASSETS_DIR not in file_path.parents and file_path != ASSETS_DIR:
            self.send_error(403)
            return
        if not file_path.exists() or not file_path.is_file():
            self.send_error(404)
            return
        ctype = {
            ".html": "text/html",
            ".css": "text/css",
            ".js": "application/javascript",
            ".svg": "image/svg+xml",
            ".png": "image/png",
        }.get(file_path.suffix, "application/octet-stream")
        body = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # noqa: N802
        parsed = urlparse(self.path)
        path, qs = parsed.path, parse_qs(parsed.query)

        try:
            if path == "/api/profiles":
                self._json(core.load_cfg()["profiles"])
            elif path == "/api/projects":
                self._json(core.load_cfg()["projects"])
            elif path == "/api/accounts":
                cfg = core.load_cfg()
                self._json({k: {**v, "hasToken": bool(core.get_token(k))} for k, v in cfg["supabaseAccounts"].items()})
            elif path == "/api/compute-status":
                self._json(core.cmd_compute_status())
            elif path == "/api/heartbeat-status":
                self._json(core.cmd_heartbeat_status())
            elif path == "/api/last-push":
                self._json(core.cmd_last_push(fetch="fetch" in qs))
            elif path == "/api/activity-heatmap":
                days = int(qs.get("days", ["70"])[0])
                self._json(core.cmd_activity_heatmap(days))
            elif path == "/api/status-breakdown":
                self._json(core.cmd_status_breakdown())
            elif path == "/api/state":
                self._json(core.load_state())
            else:
                self._static(path)
        except SystemExit as e:
            self._json({"error": str(e)}, 400)
        except Exception as e:  # noqa: BLE001
            self._json({"error": str(e)}, 500)

    def do_POST(self):  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw or b"{}")
        except json.JSONDecodeError:
            body = {}

        try:
            if path == "/api/switch":
                self._json(core.cmd_switch_identity(body["profile"], body.get("repo", ".")))
            elif path == "/api/wake":
                self._json(core.cmd_wake(body["slug"], body.get("pauseOthers", False)))
            elif path == "/api/wake-all":
                self._json(core.cmd_wake_all())
            elif path == "/api/pause":
                self._json(core.cmd_pause(body["slug"]))
            elif path == "/api/pause-idle":
                self._json(core.cmd_pause_idle())
            elif path == "/api/heartbeat":
                self._json(core.cmd_heartbeat(body.get("slug")))
            else:
                self._json({"error": "unknown endpoint"}, 404)
        except SystemExit as e:
            self._json({"error": str(e)}, 400)
        except Exception as e:  # noqa: BLE001
            self._json({"error": str(e)}, 500)


def serve(port: int = 4173, open_browser: bool = True) -> None:
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = f"http://127.0.0.1:{port}"
    print(f"sudowho dashboard running at {url}")
    print("Local only — nothing here leaves your machine. Ctrl+C to stop.")
    if open_browser:
        try:
            webbrowser.open(url)
        except Exception:  # noqa: BLE001
            pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
    serve(port)
