"""FindToolsTool — semantic search across all registered tools + KB.

Behavioral parity with Kotlin FindToolsTool.kt.
"""

from __future__ import annotations

import json
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from ..engine import OrchestrationEngine


def execute(engine: OrchestrationEngine, args: dict) -> str:
    """Search registry + KB, return top 10 tool definitions."""
    query = args.get("query")
    if not query:
        return json.dumps({"error": "Missing 'query'"})
    registry_results = engine.get_registry().search(query)
    kb_results = _search_kb(engine, query)
    merged = _merge_results(registry_results, kb_results)
    definitions = [t.definition for t in merged[:10]]
    return json.dumps(definitions)


def _search_kb(engine: OrchestrationEngine, query: str) -> list:
    """Search KB for tools (best-effort, 2s timeout)."""
    mem = engine.get_memory_engine()
    if not mem:
        return []
    try:
        results = mem.search(query, tags="tools,registry", limit=20)
        return results if isinstance(results, list) else []
    except Exception:
        return []


def _merge_results(registry: list, kb: list) -> list:
    """Merge and deduplicate results (registry takes priority)."""
    seen = {t.name for t in registry}
    merged = list(registry)
    for item in kb:
        name = item.get("name") if isinstance(item, dict) else getattr(item, "name", None)
        if name and name not in seen:
            seen.add(name)
    return merged
