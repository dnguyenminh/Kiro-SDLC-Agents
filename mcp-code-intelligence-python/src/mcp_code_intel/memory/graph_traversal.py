"""GraphTraversal — BFS, DFS, shortest path algorithms."""

from __future__ import annotations

from collections import deque

AdjMap = dict[int, set[int]]


def bfs(adj: AdjMap, start_id: int, max_depth: int) -> list[int]:
    """BFS from start node, returns visited nodes up to max_depth."""
    visited: list[int] = []
    queue: deque[tuple[int, int]] = deque([(start_id, 0)])
    seen: set[int] = {start_id}
    while queue:
        node, depth = queue.popleft()
        visited.append(node)
        if depth >= max_depth:
            continue
        for neighbor in adj.get(node, set()):
            if neighbor not in seen:
                seen.add(neighbor)
                queue.append((neighbor, depth + 1))
    return visited


def shortest_path(adj: AdjMap, from_id: int, to_id: int) -> list[int] | None:
    """Shortest path using BFS. Returns None if no path exists."""
    if from_id == to_id:
        return [from_id]
    queue: deque[int] = deque([from_id])
    parent: dict[int, int] = {}
    seen: set[int] = {from_id}
    while queue:
        node = queue.popleft()
        for neighbor in adj.get(node, set()):
            if neighbor in seen:
                continue
            parent[neighbor] = node
            if neighbor == to_id:
                return _reconstruct(parent, from_id, to_id)
            seen.add(neighbor)
            queue.append(neighbor)
    return None


def ego_graph(adj: AdjMap, reverse_adj: AdjMap, node_id: int, radius: int) -> set[int]:
    """Ego graph — all nodes within radius hops (both directions)."""
    result: set[int] = {node_id}
    queue: deque[tuple[int, int]] = deque([(node_id, 0)])
    while queue:
        current, depth = queue.popleft()
        if depth >= radius:
            continue
        neighbors = adj.get(current, set()) | reverse_adj.get(current, set())
        for n in neighbors:
            if n not in result:
                result.add(n)
                queue.append((n, depth + 1))
    return result


def _reconstruct(parent: dict[int, int], from_id: int, to_id: int) -> list[int]:
    """Reconstruct path from parent map."""
    path = [to_id]
    current = to_id
    while current != from_id:
        p = parent.get(current)
        if p is None:
            return []
        path.append(p)
        current = p
    return list(reversed(path))
