"""Semantic grouper — builds fallback chains by grouping tools with similar functionality.

Two strategies: exact name match + Jaccard description similarity.
Behavioral parity with Kotlin SemanticGrouper.kt.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass, field

from .tokenizer import tokenize


@dataclass
class RegisteredTool:
    """A tool registered in the unified registry."""

    name: str
    definition: dict
    source: str
    priority: int = 0
    name_tokens: set[str] = field(default_factory=set)
    desc_tokens: set[str] = field(default_factory=set)


@dataclass
class ChainEntry:
    """One server in a fallback chain."""

    server_name: str
    priority: int
    tool_name: str | None = None


@dataclass
class ToolChain:
    """Ordered fallback chain for a tool name."""

    tool_name: str
    entries: list[ChainEntry]
    grouping_reason: str = "exact_name"
    similar_names: set[str] = field(default_factory=set)


class SemanticGrouper:
    """Builds fallback chains via exact-name + semantic similarity."""

    def __init__(self, threshold: float = 0.7) -> None:
        self._threshold = threshold

    def build_chains(self, tools: list[RegisteredTool]) -> dict[str, ToolChain]:
        """Build all chains from registered tools."""
        chains: dict[str, ToolChain] = {}
        self._build_exact_name_chains(tools, chains)
        self._build_semantic_chains(tools, chains)
        return chains

    def compute_similarity(self, a: RegisteredTool, b: RegisteredTool) -> float:
        """Weighted Jaccard similarity between two tools."""
        tokens_a = a.name_tokens | a.desc_tokens
        tokens_b = b.name_tokens | b.desc_tokens
        if not tokens_a or not tokens_b:
            return 0.0
        intersection = tokens_a & tokens_b
        union = tokens_a | tokens_b
        jaccard = len(intersection) / len(union)
        name_overlap = len(a.name_tokens & b.name_tokens)
        return min(1.0, jaccard + name_overlap * 0.1)

    def _build_exact_name_chains(
        self, tools: list[RegisteredTool], chains: dict[str, ToolChain]
    ) -> None:
        """Group tools with identical names on different servers."""
        grouped: dict[str, list[RegisteredTool]] = {}
        for tool in tools:
            grouped.setdefault(tool.name, []).append(tool)
        for name, group in grouped.items():
            if len(group) < 2:
                continue
            entries = sorted(
                [ChainEntry(t.source.removeprefix("child:"), t.priority, t.name) for t in group],
                key=lambda e: e.priority,
            )
            chains[name] = ToolChain(name, entries, "exact_name", set())

    def _build_semantic_chains(
        self, tools: list[RegisteredTool], chains: dict[str, ToolChain]
    ) -> None:
        """Group tools with similar descriptions (different names)."""
        ungrouped = [t for t in tools if t.name not in chains]
        paired: set[str] = set()
        for i, tool_a in enumerate(ungrouped):
            if tool_a.name in paired:
                continue
            for tool_b in ungrouped[i + 1:]:
                if tool_b.name in paired:
                    continue
                sim = self.compute_similarity(tool_a, tool_b)
                if sim >= self._threshold:
                    self._merge_into_chain(tool_a, tool_b, sim, chains)
                    paired.add(tool_a.name)
                    paired.add(tool_b.name)

    def _merge_into_chain(
        self, a: RegisteredTool, b: RegisteredTool, similarity: float,
        chains: dict[str, ToolChain],
    ) -> None:
        """Merge two tools into a single fallback chain."""
        canonical = a if a.priority <= b.priority else b
        other = b if a.priority <= b.priority else a
        entries = sorted([
            ChainEntry(canonical.source.removeprefix("child:"), canonical.priority, canonical.name),
            ChainEntry(other.source.removeprefix("child:"), other.priority, other.name),
        ], key=lambda e: e.priority)
        reason = f"semantic_similarity:{similarity:.2f}"
        chain = ToolChain(canonical.name, entries, reason, {other.name})
        chains[canonical.name] = chain
        chains[other.name] = chain
        print(f"[SemanticGrouper] Grouped '{canonical.name}' + '{other.name}' (sim={similarity:.2f})", file=sys.stderr)
