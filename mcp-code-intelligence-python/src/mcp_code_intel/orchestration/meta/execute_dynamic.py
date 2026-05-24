"""ExecuteDynamicTool — execute tool with fallback chain support.

Behavioral parity with Kotlin ExecuteDynamicTool.kt.
execute_sync() is the entry point (SYNC), uses a thread internally for async calls.
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import json
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..engine import OrchestrationEngine

_EXECUTOR = concurrent.futures.ThreadPoolExecutor(max_workers=2, thread_name_prefix="exec-dyn")


def execute_sync(engine: OrchestrationEngine, args: dict) -> str:
    """Sync entry point — schedules on orchestration's event loop."""
    tool_name = args.get("tool_name")
    if not tool_name:
        return json.dumps({"error": "Missing 'tool_name'"})
    arguments = args.get("arguments", {})
    agent_name: str = args.get("agent_name", "default")

    loop = getattr(engine, '_orch_loop', None)
    if loop is None or loop.is_closed():
        return json.dumps({"error": "Orchestration event loop not available"})

    future = asyncio.run_coroutine_threadsafe(
        _execute(engine, tool_name, arguments, agent_name), loop
    )
    try:
        return future.result(timeout=60)
    except concurrent.futures.TimeoutError:
        return json.dumps({"error": f"Tool '{tool_name}' timed out (60s)"})
    except Exception as e:
        return json.dumps({"error": str(e)})


def _run_async(engine: OrchestrationEngine, tool_name: str, arguments: dict, agent_name: str = "default") -> str:
    """Run in a new event loop on the executor thread."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_execute(engine, tool_name, arguments, agent_name))
    finally:
        loop.close()


async def _execute(engine: OrchestrationEngine, tool_name: str, arguments: dict, agent_name: str = "default") -> str:
    """Async implementation — mapping check → delegate via nested execute_dynamic_tool."""
    mapping = engine.get_tool_mapping(tool_name)
    if mapping:
        server_name, original_name = mapping
        try:
            # Call the nested server's execute_dynamic_tool (not the tool directly)
            result = await engine.call_child(
                server_name, "execute_dynamic_tool",
                {"tool_name": original_name, "arguments": arguments},
                timeout_ms=60_000
            )
            engine.get_registry().record_hit(tool_name, 1)
            if not _is_error_result(result):
                engine.get_registry().record_hit(tool_name, 3)
                _fire_cache_write(engine, tool_name, server_name, agent_name)
            else:
                engine.get_registry().record_hit(tool_name, -10)
                _fire_cache_invalidate(engine, tool_name, agent_name)
            return result
        except Exception as e:
            engine.get_registry().record_hit(tool_name, -10)
            _fire_cache_invalidate(engine, tool_name, agent_name)
            return json.dumps({"error": f"Nested execute failed: {e}"})

    # No mapping — try chain or single routing
    chain = engine.get_registry().get_chain(tool_name)
    if chain:
        return await _execute_chain(engine, chain, arguments, agent_name)
    return await _execute_single(engine, tool_name, arguments, agent_name)


async def _execute_chain(engine: OrchestrationEngine, chain, arguments: dict, agent_name: str = "default") -> str:
    """Try each server in chain until one succeeds."""
    errors: list[str] = []
    for entry in chain.entries:
        actual_name = entry.tool_name or chain.tool_name
        try:
            result = await engine.call_child(entry.server_name, actual_name, arguments)
            engine.get_registry().record_hit(chain.tool_name, 1)
            if not _is_error_result(result):
                engine.get_registry().record_hit(chain.tool_name, 3)
                _fire_cache_write(engine, chain.tool_name, entry.server_name, agent_name)
            else:
                engine.get_registry().record_hit(chain.tool_name, -10)
                _fire_cache_invalidate(engine, chain.tool_name, agent_name)
            return result
        except Exception as e:
            errors.append(f"{entry.server_name}: {e}")
    tool_name = chain.tool_name
    engine.get_registry().record_hit(tool_name, -10)
    _fire_cache_invalidate(engine, tool_name, agent_name)
    error_msg = f"Tool '{tool_name}' failed on all {len(chain.entries)} servers: [{', '.join(errors)}]"
    return json.dumps({"error": error_msg})


async def _execute_single(engine: OrchestrationEngine, tool_name: str, arguments: dict, agent_name: str = "default") -> str:
    """Execute on single server via normal routing."""
    try:
        result = await engine.route(tool_name, arguments)
        engine.get_registry().record_hit(tool_name, 1)
        if not _is_error_result(result):
            engine.get_registry().record_hit(tool_name, 3)
            # Determine server_name from routing for cache write
            server_name = _resolve_server_name(engine, tool_name)
            _fire_cache_write(engine, tool_name, server_name, agent_name)
        else:
            engine.get_registry().record_hit(tool_name, -10)
            _fire_cache_invalidate(engine, tool_name, agent_name)
        return result
    except Exception as e:
        engine.get_registry().record_hit(tool_name, -10)
        _fire_cache_invalidate(engine, tool_name, agent_name)
        return json.dumps({"error": str(e)})


def _is_error_result(result: str) -> bool:
    """Check if result indicates an error response."""
    return result.lstrip().startswith('{"error"') or '"error"' in result[:100]


def _fire_cache_write(engine: OrchestrationEngine, tool_name: str, server_name: str | None, agent_name: str) -> None:
    """Fire KB cache write on successful execution (best-effort)."""
    try:
        writer_fn = getattr(engine, 'get_kb_cache_writer', None)
        if writer_fn is None:
            return
        writer = writer_fn()
        if writer is None:
            return
        tool = engine.get_registry().find(tool_name)
        writer.on_success(
            tool_name,
            server_name or "",
            tool.description if tool else "",
            tool.input_schema if tool else {},
            agent_name,
            "discovered",
        )
    except Exception:
        pass  # Best-effort, never fail execution for cache write


def _fire_cache_invalidate(engine: OrchestrationEngine, tool_name: str, agent_name: str) -> None:
    """Fire KB cache invalidation on error (best-effort)."""
    try:
        invalidator_fn = getattr(engine, 'get_kb_cache_invalidator', None)
        if invalidator_fn is None:
            return
        invalidator = invalidator_fn()
        if invalidator is None:
            return
        invalidator.on_error(tool_name, agent_name)
    except Exception:
        pass  # Best-effort, never fail execution for cache invalidation


def _resolve_server_name(engine: OrchestrationEngine, tool_name: str) -> str | None:
    """Resolve server name for a tool from registry (best-effort)."""
    try:
        tool = engine.get_registry().find(tool_name)
        if tool is not None:
            return getattr(tool, 'server_name', None)
    except Exception:
        pass
    return None
