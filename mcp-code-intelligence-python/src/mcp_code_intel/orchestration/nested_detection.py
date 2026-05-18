"""Nested orchestrator detection — detect child servers that are orchestrators."""

from __future__ import annotations

import sys

_ORCHESTRATOR_MARKERS = ("find_tools", "execute_dynamic_tool")


def is_nested_orchestrator(tool_names: list[str]) -> bool:
    """Check if a set of tool names indicates a nested orchestrator."""
    return any(marker in tool_names for marker in _ORCHESTRATOR_MARKERS)


def detect_nested(server_name: str, tools: list[dict]) -> bool:
    """Detect and log nested orchestrators from server tool lists."""
    names = [t.get("name", "") for t in tools]
    is_nested = is_nested_orchestrator(names)
    if is_nested:
        print(
            f"[orchestration] Nested orchestrator detected on '{server_name}' — tools accessible via find_tools",
            file=sys.stderr,
            flush=True,
        )
    return is_nested
