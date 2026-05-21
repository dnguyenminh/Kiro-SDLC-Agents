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
    """Search registry + cache + embedding + KB + nested delegates, return top 10."""
    query = args.get("query")
    if not query:
        return json.dumps({"error": "Missing 'query'"})

    # Tier 1: Registry search (tokenized matching)
    registry_results = engine.get_registry().search(query)

    # If no results from registry, try recovering FAILED servers (lazy retry)
    if not registry_results:
        recovered = _retry_failed_servers(engine)
        if recovered:
            registry_results = engine.get_registry().search(query)

    # Tier 4: ALWAYS delegate to nested find_tools (lazy discovery — must run every time)
    delegates = engine.get_find_tools_delegates()
    nested_results = _delegate_to_nested(engine, query) if delegates else []

    # Merge registry + nested (deduplicate by name)
    seen = {t.definition.get("name", t.name) for t in registry_results}
    all_definitions = [t.definition for t in registry_results]
    for tool_def in nested_results:
        name = tool_def.get("name", "")
        if name and name not in seen:
            seen.add(name)
            all_definitions.append(tool_def)

    if all_definitions:
        return json.dumps(all_definitions[:10])

    # Tier 2: Adaptive Token Cache (KSA-102)
    cache_result = _search_cache(engine, query)
    if cache_result:
        return cache_result

    # Tier 3: Embedding Search (KSA-102)
    embedding_result = _search_embedding(engine, query)
    if embedding_result:
        return embedding_result

    # Tier 5: KB fallback
    kb_results = _search_kb(engine, query)
    if kb_results:
        return json.dumps([t.definition for t in kb_results[:10]])

    # KSA-102 Story 5: Multilingual hint when non-ASCII query fails
    hint = _get_multilingual_hint(engine, query)
    if hint:
        return json.dumps({"tools": [], "_hint": hint})

    return json.dumps([])


def _search_cache(engine: "OrchestrationEngine", query: str) -> str | None:
    """Tier 2: Search adaptive token cache for fuzzy match."""
    try:
        from ..registry.tokenizer import tokenize
        cache = engine.get_token_cache()
        tokens = tokenize(query)
        cached = cache.find_fuzzy(tokens)
        if cached is None:
            return None
        tool = engine.get_registry().find(cached.tool_name)
        if tool is None:
            return None
        cache.schedule_persist()
        _log(f"Cache hit: '{query}' → {cached.tool_name} (hits={cached.hit_count})")
        return json.dumps([tool.definition])
    except Exception as e:
        _log(f"Cache search error: {e}")
        return None


def _search_embedding(engine: "OrchestrationEngine", query: str) -> str | None:
    """Tier 3: Search via embedding similarity with timeout."""
    try:
        searcher = engine.get_embedding_searcher()
        if searcher is None or not searcher.is_available:
            engine.get_model_manager().auto_download_if_needed()
            return None
        result = searcher.search(query, timeout_ms=100)
        if result is None:
            return None
        tool_name, score = result
        if score < 0.75:
            return None
        tool = engine.get_registry().find(tool_name)
        if tool is None:
            return None
        # Learn: add to cache for future fast lookups
        from ..registry.tokenizer import tokenize
        tokens = tokenize(query)
        cache = engine.get_token_cache()
        registry_hash = engine.get_registry().version_hash()
        cache.add(tokens, tool_name, score, registry_hash)
        cache.schedule_persist()
        _log(f"Embedding hit: '{query}' → {tool_name} (score={score:.3f})")
        return json.dumps([tool.definition])
    except Exception as e:
        _log(f"Embedding search error: {e}")
        return None


# Session-level flag: only show multilingual hint once
_multilingual_hint_shown = False


def _get_multilingual_hint(engine: "OrchestrationEngine", query: str) -> str | None:
    """Return multilingual model hint if query has non-ASCII and model is English-only."""
    global _multilingual_hint_shown
    if _multilingual_hint_shown:
        return None
    if all(ord(c) < 128 for c in query):
        return None
    active = engine.get_model_manager().get_active_model()
    if active != "all-MiniLM-L6-v2":
        return None
    _multilingual_hint_shown = True
    return (
        "💡 Tip: Current model is English-only. For better multilingual support, run: "
        "mem_model_manager(action='download', model_name='paraphrase-multilingual-MiniLM-L12-v2') "
        "then mem_model_manager(action='switch', model_name='paraphrase-multilingual-MiniLM-L12-v2')"
    )


def _retry_failed_servers(engine: "OrchestrationEngine") -> list[str]:
    """Attempt to recover FAILED servers (lazy retry on find_tools call)."""
    loop = getattr(engine, '_orch_loop', None)
    if loop is None or loop.is_closed():
        return []
    try:
        future = asyncio.run_coroutine_threadsafe(engine.retry_failed_servers(), loop)
        return future.result(timeout=15)
    except Exception as e:
        _log(f"Retry failed servers error: {e}")
        return []


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
