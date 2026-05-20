"""FindToolsTool — semantic search across all registered tools + KB + nested delegates.

Behavioral parity with Kotlin FindToolsTool.kt.
KSA-65 Option E: Lazy Discovery + KB Caching + Mapping for nested tool discovery.
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import json
import sys
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from ..engine import OrchestrationEngine

_DELEGATE_EXECUTOR = concurrent.futures.ThreadPoolExecutor(
    max_workers=2, thread_name_prefix="find-delegate"
)


def execute(engine: "OrchestrationEngine", args: dict) -> str:
    """Search registry + KB + nested delegates, return top 10 tool definitions."""
    query = args.get("query")
    if not query:
        return json.dumps({"error": "Missing 'query'"})

    # Always search local registry
    registry_results = engine.get_registry().search(query)

    # Always delegate to nested find_tools (lazy discovery)
    delegates = engine.get_find_tools_delegates()
    nested_results = _delegate_to_nested(engine, query) if delegates else []

    # Merge: registry + nested (deduplicate by name)
    seen = {t.definition.get("name", t.name) for t in registry_results}
    all_definitions = [t.definition for t in registry_results]
    for tool_def in nested_results:
        name = tool_def.get("name", "")
        if name and name not in seen:
            seen.add(name)
            all_definitions.append(tool_def)

    if all_definitions:
        return json.dumps(all_definitions[:10])

    # Fallback: KB search
    kb_results = _search_kb(engine, query)
    if kb_results:
        return json.dumps([t.definition for t in kb_results[:10]])

    return json.dumps([])


def _delegate_to_nested(engine: "OrchestrationEngine", query: str) -> list[dict]:
    """Delegate find_tools to nested orchestrators and cache results."""
    delegates = engine.get_find_tools_delegates()
    if not delegates:
        _log(f"No delegates found for find_tools")
        return []
    _log(f"Delegating find_tools('{query}') to {delegates}")
    all_results: list[dict] = []
    for server_name in delegates:
        try:
            tools = _call_nested_find_tools(engine, server_name, query)
            _log(f"Nested find_tools on {server_name} returned {len(tools)} tools")
            for tool_def in tools:
                original_name = tool_def.get("name", "")
                if not original_name:
                    continue
                unique_name = f"{server_name}::{original_name}"
                engine.register_nested_tool(unique_name, server_name, original_name, tool_def)
                all_results.append(tool_def)
        except Exception as e:
            _log(f"Nested find_tools failed on {server_name}: {e}")
            continue
    _log(f"Total nested results: {len(all_results)}")
    return all_results


def _call_nested_find_tools(engine: "OrchestrationEngine", server_name: str, query: str) -> list:
    """Call find_tools on a nested server (sync wrapper for async call)."""
    future = _DELEGATE_EXECUTOR.submit(_run_nested_call, engine, server_name, query)
    try:
        raw = future.result(timeout=45)
        _log(f"Raw response from {server_name}: {str(raw)[:200]}")
        if isinstance(raw, str):
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return parsed
            if isinstance(parsed, dict) and "tools" in parsed:
                return parsed["tools"]
            return [parsed] if parsed else []
        return raw if isinstance(raw, list) else []
    except concurrent.futures.TimeoutError:
        _log(f"Nested find_tools on {server_name} timed out (45s)")
        return []
    except Exception as e:
        _log(f"Nested find_tools error on {server_name}: {type(e).__name__}: {e}")
        return []


def _run_nested_call(engine: "OrchestrationEngine", server_name: str, query: str) -> str:
    """Run nested call on the orchestration engine's dedicated event loop."""
    import concurrent.futures
    loop = getattr(engine, '_orch_loop', None)
    if loop is None or loop.is_closed():
        raise RuntimeError("Orchestration event loop not available")

    future = asyncio.run_coroutine_threadsafe(
        engine.call_child(server_name, "find_tools", {"query": query}, timeout_ms=45_000),
        loop
    )
    try:
        return future.result(timeout=45)
    except concurrent.futures.TimeoutError:
        raise RuntimeError("Timeout waiting for nested find_tools (45s)")
    except Exception as e:
        _log(f"_run_nested_call exception: {type(e).__name__}: {e}")
        raise


def _search_kb(engine: "OrchestrationEngine", query: str) -> list:
    """Search KB for tools (best-effort, 2s timeout)."""
    mem = engine.get_memory_engine()
    if not mem:
        return []
    try:
        results = mem.search(query, tags="tools,registry", limit=20)
        return _resolve_kb_results(engine, results) if isinstance(results, list) else []
    except Exception:
        return []


def _resolve_kb_results(engine: "OrchestrationEngine", results: list) -> list:
    """Parse KB results → extract tool names → lookup in registry."""
    resolved = []
    registry = engine.get_registry()
    for result in results:
        content = result.get("content", "") if isinstance(result, dict) else str(result)
        for line in content.splitlines():
            trimmed = line.strip()
            if not trimmed:
                continue
            tool_name = trimmed.split(" [")[0].strip()
            if not tool_name:
                continue
            tool = registry.find(tool_name)
            if tool is not None:
                resolved.append(tool)
    return resolved


def _log(msg: str) -> None:
    print(f"[find_tools] {msg}", file=sys.stderr, flush=True)
