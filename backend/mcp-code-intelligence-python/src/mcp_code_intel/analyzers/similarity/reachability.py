"""BFS reachability analysis from entry points through call graph."""

from __future__ import annotations

from collections import deque
from typing import Protocol


class CallGraph(Protocol):
    """Protocol for call graph access."""

    def get_callees(self, node_id: str) -> list[str]:
        """Get all functions called by node_id."""
        ...

    def get_callers(self, node_id: str) -> list[str]:
        """Get all functions that call node_id."""
        ...


class ReachabilityAnalyzer:
    """Compute reachable set from entry points via BFS on call graph."""

    def __init__(self, call_graph: CallGraph, entry_points: list[str]) -> None:
        self._graph = call_graph
        self._entries = entry_points

    def compute_reachable(self) -> set[str]:
        """BFS from all entry points through call graph. Returns set of reachable node IDs."""
        visited: set[str] = set()
        queue: deque[str] = deque(self._entries)

        while queue:
            node = queue.popleft()
            if node in visited:
                continue
            visited.add(node)
            for callee in self._graph.get_callees(node):
                if callee not in visited:
                    queue.append(callee)

        return visited

    def get_unreachable(self, all_functions: list[str]) -> list[str]:
        """Return functions not reachable from any entry point."""
        reachable = self.compute_reachable()
        return [f for f in all_functions if f not in reachable]
