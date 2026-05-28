"""httpStream MCP server process — connects to upstream MCP server via HTTP POST.

Same state machine as ServerProcess (stdio), but no child process spawning.
Behavioral parity with Kotlin HttpStreamProcess.kt and NodeJS http-stream-process.ts.
"""

from __future__ import annotations

import asyncio
import sys
from typing import Any

from ..config import ServerEntry
from .http_json_rpc import HttpJsonRpc
from .process import ServerState


class HttpStreamProcess:
    """Manages an httpStream MCP server connection (no child process)."""

    def __init__(self, name: str, entry: ServerEntry) -> None:
        self.name = name
        self.state = ServerState.STARTING
        self.tools: list[dict] = []
        self.retry_count = 0
        self._entry = entry
        self._rpc = HttpJsonRpc(entry.url or "")

    async def start(self) -> bool:
        """Connect to httpStream server, initialize MCP handshake, fetch tools."""
        self.state = ServerState.STARTING
        self._log(f"Connecting to {self._entry.url}")
        if not await self._initialize():
            return self._mark_failed(f"Initialize handshake failed at {self._entry.url}")
        self.state = ServerState.READY
        if not await self._fetch_tools():
            return self._mark_failed("Failed to fetch tools")
        self.state = ServerState.ACTIVE
        self._log(f"Active with {len(self.tools)} tools")
        return True

    def stop(self) -> None:
        """Stop — no process to kill, just mark dead."""
        self.state = ServerState.DEAD
        self._log("Stopped")

    async def restart(self, max_retries: int) -> bool:
        """Restart — re-create RPC client and re-initialize."""
        if self.retry_count >= max_retries:
            self.state = ServerState.DEAD
            return False
        self.state = ServerState.RESTARTING
        self.retry_count += 1
        backoff_s = min(1.0 * self.retry_count, 10.0)
        self._log(f"Restarting (attempt {self.retry_count}/{max_retries}, backoff {backoff_s}s)")
        await asyncio.sleep(backoff_s)
        self._rpc = HttpJsonRpc(self._entry.url or "")
        return await self.start()

    async def call_tool(self, tool_name: str, args: dict, timeout_ms: int) -> Any:
        """Call a tool on this httpStream server via HTTP POST."""
        params = {"name": tool_name, "arguments": args}
        return await self._rpc.send_request("tools/call", params, timeout_ms)

    async def health_check(self) -> bool:
        """Health check — send tools/list via HTTP, expect response within 5s."""
        try:
            await self._rpc.send_request("tools/list", {}, 5_000)
            return True
        except Exception:
            return False

    def is_alive(self) -> bool:
        """No OS process — alive means state is ACTIVE."""
        return self.state == ServerState.ACTIVE

    async def _initialize(self) -> bool:
        """Send MCP initialize handshake via HTTP."""
        params = {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "mcp-orchestrator", "version": "1.0.0"},
        }
        try:
            await self._rpc.send_request("initialize", params, self._entry.timeout)
            self._rpc.send_notification("notifications/initialized", {})
            return True
        except Exception as e:
            self._log(f"Initialize failed: {e}")
            return False

    async def _fetch_tools(self) -> bool:
        """Fetch tools/list from httpStream server."""
        try:
            result = await self._rpc.send_request("tools/list", {}, self._entry.timeout)
            self.tools = result.get("tools", []) if isinstance(result, dict) else []
            return True
        except Exception as e:
            self._log(f"Fetch tools failed: {e}")
            return False

    def _mark_failed(self, reason: str) -> bool:
        self._log(reason)
        self.state = ServerState.FAILED
        return False

    def _log(self, msg: str) -> None:
        print(f"[{self.name}] {msg}", file=sys.stderr, flush=True)
