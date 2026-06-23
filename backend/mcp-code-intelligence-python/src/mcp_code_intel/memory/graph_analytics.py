"""GraphAnalytics — centrality, hubs, connected components analysis."""

from __future__ import annotations

from collections import deque

AdjMap = dict[int, set[int]]


def degree_centrality(adj: AdjMap) -> dict[int, float]:
    """Degree centrality — normalized count of connections per node."""
    if not adj:
        return {}
    max_degree = max((len(n) for n in adj.values()), default=0)
    if max_degree == 0:
        return {k: 0.0 for k in adj}
    return {node: len(neighbors) / max_degree for node, neighbors in adj.items()}


def find_hubs(adj: AdjMap, min_degree: int = 3) -> list[int]:
    """Find hub nodes — nodes with degree above threshold."""
    return [node for node, neighbors in adj.items() if len(neighbors) >= min_degree]


def find_isolated(adj: AdjMap) -> list[int]:
    """Find isolated nodes — nodes with no connections."""
    return [node for node, neighbors in adj.items() if len(neighbors) == 0]


def connected_components(adj: AdjMap) -> list[set[int]]:
    """Connected components using BFS."""
    visited: set[int] = set()
    components: list[set[int]] = []
    for node in adj:
        if node in visited:
            continue
        component: set[int] = set()
        queue: deque[int] = deque([node])
        while queue:
            current = queue.popleft()
            if current in visited:
                continue
            visited.add(current)
            component.add(current)
            for neighbor in adj.get(current, set()):
                if neighbor not in visited:
                    queue.append(neighbor)
        components.append(component)
    return components


def density(node_count: int, edge_count: int) -> float:
    """Graph density — ratio of actual edges to possible edges."""
    if node_count <= 1:
        return 0.0
    max_edges = node_count * (node_count - 1)
    return edge_count / max_edges
