"""Smart router — routes tool calls to child servers with timeout propagation.

Behavioral parity with Kotlin SmartRouter.kt.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from ..local.manager import LocalServerManager
from .table import RoutingTable


@dataclass
class ToolMetrics:
    """Per-tool execution metrics."""

    call_count: int = 0
    error_count: int = 0
    total_latency_ms: int = 0
    last_call_at: float | None = None


class SmartRouter:
    """Routes tool calls to child servers with timeout propagation and metrics."""

    def __init__(self, server_manager: LocalServerManager, routing_table: RoutingTable) -> None:
        self._server_manager = server_manager
        self._routing_table = routing_table
        self._metrics: dict[str, ToolMetrics] = {}
        self.request_start_time: float = 0.0

    async def route(self, tool_name: str, args: dict, timeout_ms: int = 30_000) -> str:
        """Route a tool call with timeout propagation."""
        route = self._routing_table.resolve(tool_name)
        if not route:
            raise RuntimeError(f"Tool '{tool_name}' not found in any child server")
        if route.is_native:
            raise RuntimeError(f"Tool '{tool_name}' is native — should not reach router")
        remaining = self._compute_remaining_timeout(timeout_ms, route.server_name)
        start = time.time()
        try:
            result = await self._server_manager.call_tool(route.server_name, tool_name, args, remaining)
            latency_ms = int((time.time() - start) * 1000)
            self._record_metric(tool_name, latency_ms, is_error=False)
            return self._extract_text(result)
        except Exception as e:
            latency_ms = int((time.time() - start) * 1000)
            self._record_metric(tool_name, latency_ms, is_error=True)
            raise RuntimeError(f"Tool '{tool_name}' failed on server '{route.server_name}': {e}")

    def get_metrics(self) -> dict[str, ToolMetrics]:
        """Get metrics for all tools that have been called."""
        return dict(self._metrics)

    def _compute_remaining_timeout(self, original_ms: int, server_name: str) -> int:
        """Subtract elapsed time from original timeout."""
        if self.request_start_time <= 0:
            return original_ms
        elapsed_ms = int((time.time() - self.request_start_time) * 1000)
        remaining = original_ms - elapsed_ms
        if remaining <= 0:
            raise RuntimeError(
                f"Timeout exhausted before routing to server '{server_name}' (elapsed: {elapsed_ms}ms)"
            )
        return remaining

    def _extract_text(self, result: Any) -> str:
        """Extract text content from MCP tools/call response."""
        if result is None:
            return "{}"
        if isinstance(result, dict):
            content = result.get("content")
            if isinstance(content, list) and content:
                first = content[0]
                if isinstance(first, dict):
                    return first.get("text", "{}")
        return str(result)

    def _record_metric(self, tool: str, latency_ms: int, is_error: bool) -> None:
        """Record execution metric for a tool."""
        if tool not in self._metrics:
            self._metrics[tool] = ToolMetrics()
        m = self._metrics[tool]
        m.call_count += 1
        if is_error:
            m.error_count += 1
        m.total_latency_ms += latency_ms
        m.last_call_at = time.time()
