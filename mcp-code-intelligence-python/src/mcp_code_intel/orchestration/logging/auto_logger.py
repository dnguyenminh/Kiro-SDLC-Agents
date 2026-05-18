"""Auto-logger — logs tool calls to memory audit trail.

Behavioral parity with Kotlin AutoLogger.kt.
"""

from __future__ import annotations

import sys
from typing import Any

from ..config import AutoLogSettings


class AutoLogger:
    """Logs tool calls to memory engine audit trail."""

    def __init__(self, memory_engine: Any, settings: AutoLogSettings) -> None:
        self._memory_engine = memory_engine
        self._settings = settings

    def log_call(
        self, tool: str, args: str, result: str,
        latency_ms: int, source: str, is_error: bool = False,
    ) -> None:
        """Log a tool call to memory audit."""
        if not self._settings.enabled:
            return
        if tool in self._settings.exclude_tools:
            return
        mem = self._memory_engine
        if not mem:
            return
        truncated_args = args[: self._settings.max_arg_length]
        details = f"{tool}({truncated_args}) → {latency_ms}ms [{source}]"
        if is_error:
            details += " [ERROR]"
        try:
            mem.audit.log("TOOL_CALL", session_id=mem.session_id, details=details)
        except Exception:
            pass
