"""JSON-RPC 2.0 over HTTP POST — sends requests to upstream httpStream MCP servers.

Handles both JSON and SSE response formats.
Manages Mcp-Session-Id header automatically.
Behavioral parity with Kotlin HttpJsonRpc.kt and NodeJS http-json-rpc.ts.
"""

from __future__ import annotations

import asyncio
import json
import sys
from typing import Any
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


class HttpJsonRpc:
    """JSON-RPC 2.0 client over HTTP POST."""

    def __init__(self, url: str) -> None:
        self._url = url
        self._session_id: str | None = None
        self._next_id = 1

    async def send_request(self, method: str, params: Any, timeout_ms: int) -> Any:
        """Send JSON-RPC request via HTTP POST and await response with timeout."""
        req_id = self._next_id
        self._next_id += 1
        body = json.dumps({"jsonrpc": "2.0", "id": req_id, "method": method, "params": params})
        try:
            return await asyncio.wait_for(
                self._execute(body), timeout=timeout_ms / 1000.0
            )
        except asyncio.TimeoutError:
            raise RuntimeError(f"Timeout after {timeout_ms}ms waiting for {method}")

    def send_notification(self, method: str, params: Any) -> None:
        """Send JSON-RPC notification (fire-and-forget, no response expected)."""
        body = json.dumps({"jsonrpc": "2.0", "method": method, "params": params})
        try:
            req = self._build_request(body)
            urlopen(req, timeout=5)
        except Exception:
            pass

    async def _execute(self, body: str) -> Any:
        """Execute HTTP POST in thread pool to avoid blocking event loop."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._do_post, body)

    def _do_post(self, body: str) -> Any:
        """Synchronous HTTP POST — runs in executor thread."""
        req = self._build_request(body)
        try:
            response = urlopen(req, timeout=60)
        except HTTPError as e:
            text = e.read().decode("utf-8", errors="replace")[:200]
            raise RuntimeError(f"HTTP {e.code}: {e.reason} — {text}")
        except URLError as e:
            raise RuntimeError(f"Connection failed: {e.reason}")

        # Capture session ID
        sid = response.headers.get("mcp-session-id")
        if sid:
            self._session_id = sid

        content_type = response.headers.get("content-type", "")
        data = response.read().decode("utf-8")

        if "text/event-stream" in content_type:
            return self._parse_sse(data)
        return self._parse_json_response(data)

    def _build_request(self, body: str) -> Request:
        """Build urllib Request with appropriate headers."""
        req = Request(self._url, data=body.encode("utf-8"), method="POST")
        req.add_header("Content-Type", "application/json")
        req.add_header("Accept", "application/json, text/event-stream")
        if self._session_id:
            req.add_header("Mcp-Session-Id", self._session_id)
        return req

    def _parse_json_response(self, data: str) -> Any:
        """Parse JSON-RPC response body."""
        obj = json.loads(data)
        error = obj.get("error")
        if error:
            raise RuntimeError(error.get("message", f"JSON-RPC error code {error.get('code')}"))
        return obj.get("result")

    def _parse_sse(self, text: str) -> Any:
        """Parse SSE response — extract last data line containing JSON-RPC result."""
        lines = text.split("\n")
        for line in reversed(lines):
            line = line.strip()
            if not line.startswith("data:"):
                continue
            data_str = line[5:].strip()
            if not data_str:
                continue
            obj = json.loads(data_str)
            error = obj.get("error")
            if error:
                raise RuntimeError(error.get("message", f"JSON-RPC error code {error.get('code')}"))
            return obj.get("result")
        raise RuntimeError("No data in SSE response")
