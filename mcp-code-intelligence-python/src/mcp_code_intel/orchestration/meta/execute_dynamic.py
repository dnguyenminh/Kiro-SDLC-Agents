"""ExecuteDynamicTool — execute tool with fallback chain support.

Behavioral parity with Kotlin ExecuteDynamicTool.kt.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..engine import OrchestrationEngine


async def execute(engine: OrchestrationEngine, args: dict) -> str:
    """Execute tool with fallback chain support."""
    tool_name = args.get("tool_name")
    if not tool_name:
        return json.dumps({"error": "Missing 'tool_name'"})
    arguments = args.get("arguments", {})
    chain = engine.get_registry().get_chain(tool_name)
    if chain:
        return await _execute_chain(engine, chain, arguments)
    return await _execute_single(engine, tool_name, arguments)


async def _execute_chain(engine: OrchestrationEngine, chain, arguments: dict) -> str:
    """Try each server in chain until one succeeds."""
    errors: list[str] = []
    for entry in chain.entries:
        actual_name = entry.tool_name or chain.tool_name
        try:
            result = await engine.call_child(entry.server_name, actual_name, arguments)
            engine.get_registry().record_hit(chain.tool_name)
            return result
        except Exception as e:
            errors.append(f"{entry.server_name}: {e}")
    error_msg = f"Tool '{chain.tool_name}' failed on all {len(chain.entries)} servers: [{', '.join(errors)}]"
    return json.dumps({"error": error_msg})


async def _execute_single(engine: OrchestrationEngine, tool_name: str, arguments: dict) -> str:
    """Execute on single server via normal routing."""
    try:
        result = await engine.route(tool_name, arguments)
        engine.get_registry().record_hit(tool_name)
        return result
    except Exception as e:
        return json.dumps({"error": str(e)})
