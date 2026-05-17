"""KnowledgeGraph — in-memory graph with BFS, shortest path, ego graph."""

from collections import deque
from typing import Any

from .graph_repo import GraphRepository


class KnowledgeGraph:
    """In-memory graph with SQLite persistence."""

    def __init__(self, repo: GraphRepository) -> None:
        self._repo = repo
        self._adj: dict[int, set[int]] = {}
        self._rev: dict[int, set[int]] = {}

    def load_from_db(self) -> None:
        """Load all edges from database into memory."""
        edges = self._repo.find_all()
        for edge in edges:
            self._add_to_memory(edge["source_id"], edge["target_id"])

    def add_edge(self, source_id: int, target_id: int,
                 relation: str = "RELATES_TO") -> int:
        """Add edge, persist to DB, update in-memory graph."""
        edge_id = self._repo.add_edge(source_id, target_id, relation)
        self._add_to_memory(source_id, target_id)
        return edge_id

    def get_connected(self, node_id: int) -> set[int]:
        """Get all connected nodes (both directions)."""
        out = self._adj.get(node_id, set())
        inc = self._rev.get(node_id, set())
        return out | inc

    def shortest_path(self, from_id: int, to_id: int) -> list[int] | None:
        """BFS shortest path. Returns None if no path."""
        if from_id == to_id:
            return [from_id]
        queue: deque[int] = deque([from_id])
        parent: dict[int, int] = {}
        seen = {from_id}
        while queue:
            node = queue.popleft()
            for neighbor in self._adj.get(node, set()):
                if neighbor in seen:
                    continue
                parent[neighbor] = node
                if neighbor == to_id:
                    return self._reconstruct(parent, from_id, to_id)
                seen.add(neighbor)
                queue.append(neighbor)
        return None

    def ego_graph(self, node_id: int, radius: int = 2) -> set[int]:
        """All nodes within radius hops (both directions)."""
        result = {node_id}
        queue: deque[tuple[int, int]] = deque([(node_id, 0)])
        while queue:
            current, depth = queue.popleft()
            if depth >= radius:
                continue
            neighbors = self._adj.get(current, set()) | self._rev.get(current, set())
            for n in neighbors:
                if n not in result:
                    result.add(n)
                    queue.append((n, depth + 1))
        return result

    def _add_to_memory(self, source_id: int, target_id: int) -> None:
        self._adj.setdefault(source_id, set()).add(target_id)
        self._adj.setdefault(target_id, set())
        self._rev.setdefault(target_id, set()).add(source_id)
        self._rev.setdefault(source_id, set())

    def _reconstruct(self, parent: dict[int, int], from_id: int, to_id: int) -> list[int]:
        path = [to_id]
        current = to_id
        while current != from_id:
            p = parent.get(current)
            if p is None:
                return []
            path.append(p)
            current = p
        return list(reversed(path))
