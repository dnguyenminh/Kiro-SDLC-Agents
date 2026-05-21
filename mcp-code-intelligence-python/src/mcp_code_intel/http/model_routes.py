"""HTTP routes for model management — list, download, status, switch."""

import json
import sys
from http.server import BaseHTTPRequestHandler


def handle_model_route(
    path: str, query: dict, handler: BaseHTTPRequestHandler,
    model_manager, method: str = "GET"
) -> bool:
    """Handle /api/models/* routes. Returns True if handled."""
    if not model_manager:
        _send_json(handler, 503, {"error": "Model manager not initialized"})
        return True

    if path == "/api/models/list" and method == "GET":
        result = model_manager.execute({"action": "list"})
        _send_json(handler, 200, json.loads(result))
        return True

    if path == "/api/models/status" and method == "GET":
        result = model_manager.execute({"action": "status"})
        _send_json(handler, 200, json.loads(result))
        return True

    if path == "/api/models/download" and method == "POST":
        body = _read_body(handler)
        if not body:
            _send_json(handler, 400, {"error": "Missing body"})
            return True
        args = json.loads(body)
        args["action"] = "download"
        result = model_manager.execute(args)
        parsed = json.loads(result)
        code = 200 if parsed.get("success") else 400
        _send_json(handler, code, parsed)
        return True

    if path == "/api/models/switch" and method == "POST":
        body = _read_body(handler)
        if not body:
            _send_json(handler, 400, {"error": "Missing body"})
            return True
        args = json.loads(body)
        args["action"] = "switch"
        result = model_manager.execute(args)
        parsed = json.loads(result)
        code = 200 if parsed.get("success") else 400
        _send_json(handler, code, parsed)
        return True

    return False


def _read_body(handler: BaseHTTPRequestHandler) -> str:
    """Read POST body."""
    length = int(handler.headers.get("Content-Length", 0))
    if length == 0:
        return ""
    return handler.rfile.read(length).decode("utf-8")


def _send_json(handler: BaseHTTPRequestHandler, code: int, data: dict) -> None:
    """Send JSON response with CORS."""
    body = json.dumps(data).encode("utf-8")
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _log(msg: str) -> None:
    print(f"[model-routes] {msg}", file=sys.stderr, flush=True)
