"""Union-Find clustering for grouping near-duplicate code."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Cluster:
    """A group of near-duplicate functions."""
    representative: str
    members: list[str] = field(default_factory=list)


class ClusterBuilder:
    """Build duplicate clusters using Union-Find with path compression and union by rank."""

    def __init__(self) -> None:
        self._parent: dict[str, str] = {}
        self._rank: dict[str, int] = {}

    def union(self, a: str, b: str) -> None:
        """Merge two nodes into the same cluster."""
        root_a = self.find(a)
        root_b = self.find(b)
        if root_a == root_b:
            return
        # Union by rank
        rank_a = self._rank.get(root_a, 0)
        rank_b = self._rank.get(root_b, 0)
        if rank_a < rank_b:
            self._parent[root_a] = root_b
        elif rank_a > rank_b:
            self._parent[root_b] = root_a
        else:
            self._parent[root_b] = root_a
            self._rank[root_a] = rank_a + 1

    def find(self, x: str) -> str:
        """Find cluster representative with path compression."""
        if x not in self._parent:
            self._parent[x] = x
            self._rank[x] = 0
        # Path compression
        if self._parent[x] != x:
            self._parent[x] = self.find(self._parent[x])
        return self._parent[x]

    def get_clusters(self) -> list[Cluster]:
        """Return all clusters with 2+ members."""
        groups: dict[str, list[str]] = {}
        for node in self._parent:
            root = self.find(node)
            groups.setdefault(root, []).append(node)
        return [
            Cluster(representative=root, members=sorted(members))
            for root, members in groups.items()
            if len(members) >= 2
        ]
