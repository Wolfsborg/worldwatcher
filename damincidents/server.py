#!/usr/bin/env python3
"""Serve the Dam Incidents app and maintenance API. Stdlib only."""

from __future__ import annotations

import json
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import maintain

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "data" / "incidents.json"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _send_json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        if not raw:
            return {}
        return json.loads(raw.decode("utf-8"))

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/incidents":
            try:
                db = maintain.load_db(DB_PATH)
            except OSError as exc:
                return self._send_json(500, {"error": str(exc)})
            return self._send_json(200, db)
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            body = self._read_json()
        except json.JSONDecodeError:
            return self._send_json(400, {"error": "invalid json"})

        if path == "/api/check":
            try:
                db = maintain.load_db(DB_PATH)
            except OSError as exc:
                return self._send_json(500, {"error": str(exc)})
            matches = maintain.find_matches(db, body if isinstance(body, dict) else {})
            return self._send_json(200, {"matches": matches})

        if path == "/api/upsert":
            if not isinstance(body, dict):
                return self._send_json(400, {"error": "expected object"})
            incident = body.get("incident") if isinstance(body.get("incident"), dict) else body
            target_id = body.get("target_id")
            try:
                db = maintain.load_db(DB_PATH)
            except OSError as exc:
                return self._send_json(500, {"error": str(exc)})
            result = maintain.upsert(db, incident, target_id=target_id)
            if result.get("action") in {"created", "merged"}:
                maintain.save_db(DB_PATH, db)
            return self._send_json(200, result)

        self.send_error(404)


def main():
    port = 8080
    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print("Serving on http://127.0.0.1:%s/" % port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped")
        server.server_close()


if __name__ == "__main__":
    main()
