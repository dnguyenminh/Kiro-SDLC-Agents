"""Local server manager — manages multiple child MCP server processes.

Start, stop, health monitoring, tool routing.
Behavioral parity with Kotlin LocalServerManager.kt.
"""

from __future__ import annotations

import asyncio
import sys
from typing import Any

from ..config import OrchestrationConfig, ServerEntry, TransportType
from .process import ServerProcess, ServerState
from .transport import detect_transport
from .http_stream_process import HttpStreamProcess


class LocalServerManager:
    """Manages multiple child MCP server processes."""

    def __init__(self, config: OrchestrationConfig) -> None:
        self._config = config
        self._servers: dict[str, ServerProcess | HttpStreamProcess] = {}
        self._health_task: asyncio.Task | None = None

    def update_config(self, new_config: OrchestrationConfig) -> None:
        """Update config reference (used by hot-reload)."""
        self._config = new_config

    async def start_all(self) -> int:
        """Start all enabled servers. Returns count of successfully started."""
        entries = self._config.enabled_servers()
        _log(f"Starting {len(entries)} child servers...")
        started = 0
        for name, entry in entries.items():
            transport = detect_transport(entry)
            if transport == TransportType.HTTP_STREAM:
                server = HttpStreamProcess(name, entry)
            else:
                server = ServerProcess(name, entry)
            self._servers[name] = server
            if await server.start():
                started += 1
            else:
                _log(f"[{name}] Failed to start (transport: {transport.value})")
        self._start_health_monitor()
        return started

    def stop_all(self) -> None:
        """Stop all child servers gracefully."""
        if self._health_task:
            self._health_task.cancel()
            self._health_task = None
        for server in self._servers.values():
            server.stop()
        self._servers.clear()
        _log("All child servers stopped")

    async def call_tool(self, server_name: str, tool_name: str, args: dict, timeout_ms: int) -> Any:
        """Call a tool on the specified server."""
        server = self._servers.get(server_name)
        if not server:
            raise RuntimeError(f"Server '{server_name}' not found (tool: '{tool_name}')")
        if server.state != ServerState.ACTIVE:
            raise RuntimeError(f"Server '{server_name}' is {server.state.value}")
        return await server.call_tool(tool_name, args, timeout_ms)

    def find_server_for_tool(self, tool_name: str) -> str | None:
        """Find which server owns a given tool name."""
        for name, server in self._servers.items():
            if server.state != ServerState.ACTIVE:
                continue
            if any(t.get("name") == tool_name for t in server.tools):
                return name
        return None

    def get_all_tools(self) -> list[tuple[str, dict]]:
        """Get all tools from all active child servers."""
        result = []
        for name, server in self._servers.items():
            if server.state == ServerState.ACTIVE:
                result.extend((name, t) for t in server.tools)
        return result

    def get_status(self) -> dict[str, ServerState]:
        """Get status of all managed servers."""
        return {name: s.state for name, s in self._servers.items()}

    def get_server_status_info(self) -> list[dict]:
        """Get detailed status info for orchestration_status tool."""
        return [
            {"name": name, "state": s.state.value, "toolCount": len(s.tools)}
            for name, s in self._servers.items()
        ]

    async def retry_failed_servers(self) -> list[str]:
        """Retry starting servers that are in FAILED state. Returns names of newly active servers."""
        recovered: list[str] = []
        for name, server in list(self._servers.items()):
            if server.state != ServerState.FAILED:
                continue
            _log(f"[{name}] Retrying failed server...")
            server.retry_count = 0  # Reset retry count for fresh attempt
            if await server.start():
                recovered.append(name)
                _log(f"[{name}] Recovered — now active with {len(server.tools)} tools")
            else:
                _log(f"[{name}] Still failing")
        return recovered

    def _start_health_monitor(self) -> None:
        """Start background health check task."""
        interval_s = self._config.settings.health_check_interval_ms / 1000.0
        self._health_task = asyncio.create_task(self._health_loop(interval_s))

    async def _health_loop(self, interval_s: float) -> None:
        """Periodically check health of all active servers."""
        try:
            while True:
                await asyncio.sleep(interval_s)
                await self._check_health()
        except asyncio.CancelledError:
            pass

    async def _check_health(self) -> None:
        """Check each active server, restart if unhealthy. Also retry FAILED servers."""
        for server in list(self._servers.values()):
            if server.state == ServerState.FAILED:
                _log(f"[{server.name}] Health check: retrying failed server")
                server.retry_count = 0
                if await server.start():
                    _log(f"[{server.name}] Recovered via health check")
                continue
            if server.state != ServerState.ACTIVE:
                continue
            if not server.is_alive() or not await server.health_check():
                _log(f"[{server.name}] Unhealthy — attempting restart")
                max_retries = self._config.settings.max_restart_retries
                if not await server.restart(max_retries):
                    _log(f"[{server.name}] Permanently dead after {max_retries} retries")


def _log(msg: str) -> None:
    print(f"[orchestration] {msg}", file=sys.stderr, flush=True)
