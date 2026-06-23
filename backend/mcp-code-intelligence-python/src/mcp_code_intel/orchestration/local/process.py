"""Single child MCP server process lifecycle — spawn, initialize, fetch tools, health check.

State machine: STARTING → READY → ACTIVE → CRASHED → RESTARTING → DEAD.
Behavioral parity with Kotlin ServerProcess.kt.
"""

from __future__ import annotations

import asyncio
import os
import platform
import subprocess
import sys
from enum import Enum
from typing import Any

from ..config import ServerEntry
from .rpc import StdioJsonRpc


class ServerState(Enum):
    """Server lifecycle states."""

    STARTING = "STARTING"
    READY = "READY"
    ACTIVE = "ACTIVE"
    CRASHED = "CRASHED"
    RESTARTING = "RESTARTING"
    STOPPING = "STOPPING"
    DEAD = "DEAD"
    FAILED = "FAILED"


class ServerProcess:
    """Manages a single child MCP server process."""

    def __init__(self, name: str, entry: ServerEntry) -> None:
        self.name = name
        self.state = ServerState.STARTING
        self.tools: list[dict] = []
        self.retry_count = 0
        self._entry = entry
        self._proc: asyncio.subprocess.Process | None = None
        self.rpc = StdioJsonRpc()

    async def start(self) -> bool:
        """Start child process, initialize MCP handshake, fetch tools."""
        self.state = ServerState.STARTING
        proc = await self._spawn()
        if not proc:
            return self._mark_failed("Failed to spawn process")
        self._proc = proc
        self.rpc.attach(proc)
        if not await self._initialize():
            return self._mark_failed("Initialize handshake failed")
        self.state = ServerState.READY
        if not await self._fetch_tools():
            return self._mark_failed("Failed to fetch tools")
        self.state = ServerState.ACTIVE
        self._log(f"Active with {len(self.tools)} tools")
        return True

    def stop(self) -> None:
        """Stop child process gracefully."""
        self.state = ServerState.STOPPING
        self.rpc.detach()
        self._destroy_process()
        self.state = ServerState.DEAD
        self._log("Stopped")

    async def restart(self, max_retries: int) -> bool:
        """Restart after crash with exponential backoff."""
        if self.retry_count >= max_retries:
            self.state = ServerState.DEAD
            return False
        self.state = ServerState.RESTARTING
        self.retry_count += 1
        backoff_s = min(1.0 * self.retry_count, 10.0)
        self._log(f"Restarting (attempt {self.retry_count}/{max_retries}, backoff {backoff_s}s)")
        await asyncio.sleep(backoff_s)
        self._destroy_process()
        return await self.start()

    async def call_tool(self, tool_name: str, args: dict, timeout_ms: int) -> Any:
        """Call a tool on this child server via JSON-RPC."""
        params = {"name": tool_name, "arguments": args}
        return await self.rpc.send_request("tools/call", params, timeout_ms)

    async def health_check(self) -> bool:
        """Health check — send tools/list, expect response within 5s."""
        try:
            await self.rpc.send_request("tools/list", {}, 5_000)
            return True
        except Exception:
            return False

    def is_alive(self) -> bool:
        """Check if OS process is still running."""
        return self._proc is not None and self._proc.returncode is None

    async def _spawn(self) -> asyncio.subprocess.Process | None:
        """Spawn child process with configured command and args."""
        try:
            if not self._entry.command:
                self._log("No command specified")
                return None
            cmd = self._resolve_command(self._entry.command)
            args = list(self._entry.args)
            # Note: depth args NOT injected for third-party servers
            # (they don't understand --depth/--max-depth)
            env = {**os.environ, **self._entry.env}
            return await asyncio.create_subprocess_exec(
                *cmd, *args,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )
        except Exception as e:
            self._log(f"Spawn failed: {e}")
            return None

    def _resolve_command(self, cmd: str) -> list[str]:
        """On Windows, wrap non-exe commands with cmd /c."""
        if not self._is_windows():
            return [cmd]
        lower = cmd.lower()
        if lower.endswith((".exe", ".bat", ".cmd")):
            return [cmd]
        return ["cmd", "/c", cmd]

    async def _initialize(self) -> bool:
        """Send MCP initialize handshake."""
        params = {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "mcp-orchestrator", "version": "1.0.0"},
        }
        try:
            await self.rpc.send_request("initialize", params, self._entry.timeout)
            self.rpc.send_notification("notifications/initialized", {})
            return True
        except Exception as e:
            self._log(f"Initialize failed: {e}")
            return False

    async def _fetch_tools(self) -> bool:
        """Fetch tools/list from child server."""
        try:
            result = await self.rpc.send_request("tools/list", {}, self._entry.timeout)
            self.tools = result.get("tools", []) if isinstance(result, dict) else []
            return True
        except Exception as e:
            self._log(f"Fetch tools failed: {e}")
            return False

    def _destroy_process(self) -> None:
        """Kill child process (tree kill on Windows)."""
        proc = self._proc
        if not proc:
            return
        if proc.returncode is None:
            if not self._try_windows_tree_kill(proc):
                proc.kill()
        self._proc = None

    def _try_windows_tree_kill(self, proc: asyncio.subprocess.Process) -> bool:
        """On Windows, use taskkill /T /F /PID for tree kill."""
        if not self._is_windows():
            return False
        try:
            pid = proc.pid
            subprocess.run(
                ["taskkill", "/T", "/F", "/PID", str(pid)],
                capture_output=True, timeout=3,
            )
            return True
        except Exception:
            return False

    def _is_windows(self) -> bool:
        return platform.system() == "Windows"

    def _mark_failed(self, reason: str) -> bool:
        self._log(reason)
        self.state = ServerState.FAILED
        return False

    def _log(self, msg: str) -> None:
        print(f"[{self.name}] {msg}", file=sys.stderr, flush=True)
