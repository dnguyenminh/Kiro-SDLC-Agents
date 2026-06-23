"""Shared response helpers for API route handlers."""

import json
from http.server import BaseHTTPRequestHandler
from typing import Any


def to_entry_response(e: dict[str, Any], score: float = 0) -> dict[str, Any]:
    """Map entry to API response (without content)."""
    return {
        "id": e["id"], "summary": e["summary"], "type": e["type"],
        "tier": e["tier"], "confidence": e.get("confidence", 1.0),
        "accessCount": e.get("access_count", 0),
        "source": e.get("source"), "tags": e.get("tags", ""), "score": score,
    }


def to_detail_response(e: dict[str, Any]) -> dict[str, Any]:
    """Map entry to detail response (with content)."""
    return {
        "id": e["id"], "summary": e["summary"], "content": e.get("content", ""),
        "type": e["type"], "tier": e["tier"], "confidence": e.get("confidence", 1.0),
        "accessCount": e.get("access_count", 0),
        "source": e.get("source"), "tags": e.get("tags", ""),
    }


def to_graph_node(e: dict[str, Any]) -> dict[str, Any]:
    """Map entry to graph node response."""
    return {
        "id": e["id"], "summary": (e.get("summary") or "")[:60],
        "type": e["type"], "tier": e["tier"], "source": e.get("source"),
    }


def send_json(handler: BaseHTTPRequestHandler, data: Any) -> None:
    """Send JSON response with CORS headers."""
    body = json.dumps(data).encode("utf-8")
    handler.send_response(200)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def send_error(handler: BaseHTTPRequestHandler, code: int, message: str) -> None:
    """Send error JSON response."""
    body = json.dumps({"error": message}).encode("utf-8")
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def first_param(query: dict[str, list[str]], key: str, default: str) -> str:
    """Get first value from query params or default."""
    values = query.get(key, [])
    return values[0] if values else default
