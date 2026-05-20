"""Unified registry — merges native + child server tools into a searchable index.

Supports fallback chains, tokenized search, hit tracking, and session toggles.
Behavioral parity with Kotlin UnifiedRegistry.kt.
"""

from __future__ import annotations

from .grouper import ChainEntry, RegisteredTool, SemanticGrouper, ToolChain
from .tokenizer import tokenize

META_TOOL_NAMES = frozenset({
    "find_tools", "execute_dynamic_tool", "toggle_tool",
    "reset_tools", "manage_auto_approve", "orchestration_status", "agent_log",
})


class UnifiedRegistry:
    """Searchable tool index with fallback chains and hit-based ranking."""

    def __init__(self, similarity_threshold: float = 0.7) -> None:
        self._similarity_threshold = similarity_threshold
        self._native_tools: list[RegisteredTool] = []
        self._child_tools: list[RegisteredTool] = []
        self._merged: list[RegisteredTool] = []
        self._toggles: dict[str, bool] = {}
        self._chains: dict[str, ToolChain] = {}
        self._server_order: list[str] = []
        self._hits: dict[str, int] = {}

    def set_server_order(self, order: list[str]) -> None:
        """Set config-declared server order (determines fallback priority)."""
        self._server_order = order

    def set_child_tools(self, server_name: str, tools: list[dict]) -> None:
        """Register tools from a child server (filters meta-tools)."""
        filtered = [t for t in tools if t.get("name", "") not in META_TOOL_NAMES]
        priority = self._server_order.index(server_name) if server_name in self._server_order else 999
        self._child_tools = [t for t in self._child_tools if t.source != f"child:{server_name}"]
        for defn in filtered:
            name = defn.get("name", "unknown")
            desc = defn.get("description", "")
            self._child_tools.append(RegisteredTool(
                name=name, definition=defn, source=f"child:{server_name}",
                priority=priority, name_tokens=tokenize(name), desc_tokens=tokenize(desc),
            ))
        self._rebuild()

    def search(self, query: str) -> list[RegisteredTool]:
        """Tokenized search — scores by relevance + popularity."""
        terms = tokenize(query)
        if not terms:
            return [t for t in self._merged if self.is_enabled(t.name)]
        max_hits = max((self._hits.get(t.name, 0) for t in self._merged), default=1) or 1
        scored = []
        for tool in self._merged:
            if not self.is_enabled(tool.name):
                continue
            score = self._combined_score(tool, terms, max_hits)
            if score > 0.0:
                scored.append((tool, score))
        scored.sort(key=lambda x: x[1], reverse=True)
        return [t for t, _ in scored]

    def find(self, name: str) -> RegisteredTool | None:
        """Find tool by exact name."""
        for t in self._merged:
            if t.name == name and self.is_enabled(t.name):
                return t
        return None

    def get_chain(self, tool_name: str) -> ToolChain | None:
        """Get fallback chain for a tool name."""
        return self._chains.get(tool_name)

    def record_hit(self, tool_name: str, weight: int = 1) -> None:
        """Record successful execution hit. Triggers decay if > 1000."""
        self._hits[tool_name] = self._hits.get(tool_name, 0) + weight
        if self._hits[tool_name] > 1000:
            self._apply_decay(tool_name)

    def toggle(self, tool_name: str, enabled: bool) -> None:
        """Toggle tool on/off for this session."""
        self._toggles[tool_name] = enabled

    def reset_toggles(self) -> None:
        """Reset all session toggles."""
        self._toggles.clear()

    def is_enabled(self, tool_name: str) -> bool:
        """Check if tool is enabled."""
        return self._toggles.get(tool_name, True)

    def get_all(self) -> list[dict]:
        """Get all enabled tool definitions."""
        return [t.definition for t in self._merged if self.is_enabled(t.name)]

    def child_tools_by_server(self) -> dict[str, list[str]]:
        """Get child tool names grouped by server."""
        result: dict[str, list[str]] = {}
        for t in self._child_tools:
            result.setdefault(t.source, []).append(t.name)
        return result

    def all_child_tools(self) -> list[RegisteredTool]:
        """Get all child tools as flat list."""
        return list(self._child_tools)

    def register_nested(self, unique_name: str, server_name: str, definition: dict) -> None:
        """Register a tool discovered via nested find_tools delegation."""
        existing = self.find(unique_name)
        if existing:
            return
        name = definition.get("name", unique_name)
        desc = definition.get("description", "")
        priority = self._server_order.index(server_name) if server_name in self._server_order else 999
        tool = RegisteredTool(
            name=unique_name, definition=definition, source=f"nested:{server_name}",
            priority=priority, name_tokens=tokenize(name), desc_tokens=tokenize(desc),
        )
        self._child_tools.append(tool)
        self._merged.append(tool)

    def _combined_score(self, tool: RegisteredTool, terms: set[str], max_hits: int) -> float:
        """Combined relevance + popularity score."""
        relevance = self._score_against_terms(tool, terms)
        if relevance <= 0.0:
            return 0.0
        normalized_hits = self._hits.get(tool.name, 0) / max_hits
        return normalized_hits * 0.6 + relevance * 0.4

    def _score_against_terms(self, tool: RegisteredTool, query_terms: set[str]) -> float:
        """Score tool against query terms."""
        score = 0.0
        for term in query_terms:
            if term in tool.name_tokens:
                score += 2.0
            elif any(term in dt for dt in tool.desc_tokens):
                score += 1.0
        return score / (len(query_terms) * 2.0) if query_terms else 0.0

    def _apply_decay(self, trigger_tool: str) -> None:
        """Decay: subtract 500 from group, floor at -2000."""
        chain = self._chains.get(trigger_tool)
        if chain:
            group_names = {e.tool_name or chain.tool_name for e in chain.entries} | chain.similar_names
        else:
            group_names = {trigger_tool}
        for name in group_names:
            if name in self._hits:
                self._hits[name] = max(-2000, self._hits[name] - 500)

    def _rebuild(self) -> None:
        """Rebuild merged list and chains."""
        merged_map: dict[str, RegisteredTool] = {}
        for t in self._child_tools:
            merged_map[t.name] = t
        for t in self._native_tools:
            merged_map[t.name] = t
        self._merged = list(merged_map.values())
        grouper = SemanticGrouper(self._similarity_threshold)
        self._chains = grouper.build_chains(self._child_tools)
