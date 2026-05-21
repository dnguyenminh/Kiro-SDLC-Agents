"""Graph analyzer — server-side graph structure analysis for KB."""

import sqlite3
from datetime import datetime, timedelta
from typing import Any


class GraphAnalyzer:
    """Analyzes knowledge graph structure and generates insights."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def analyze(self) -> dict[str, Any]:
        """Run full graph analysis and return insights + stats."""
        stats = self._compute_stats()
        insights = []
        insights.extend(self._find_orphans())
        insights.extend(self._find_hubs())
        insights.extend(self._find_clusters())
        insights.extend(self._find_stale_nodes())
        return {
            "insights": insights,
            "stats": stats,
            "computed_at": datetime.now().isoformat(),
        }

    def _compute_stats(self) -> dict[str, Any]:
        """Compute basic graph statistics."""
        try:
            node_count = self._conn.execute(
                "SELECT COUNT(*) FROM entries"
            ).fetchone()[0]
            edge_count = self._conn.execute(
                "SELECT COUNT(*) FROM relationships"
            ).fetchone()[0]
        except Exception:
            return {"node_count": 0, "edge_count": 0, "density": 0}
        max_edges = node_count * (node_count - 1) if node_count > 1 else 1
        density = round(edge_count / max_edges, 4) if max_edges > 0 else 0
        return {
            "node_count": node_count,
            "edge_count": edge_count,
            "density": density,
        }

    def _find_orphans(self) -> list[dict]:
        """Find nodes with zero edges."""
        try:
            rows = self._conn.execute(
                "SELECT e.id, e.summary, e.type FROM entries e "
                "WHERE e.id NOT IN ("
                "  SELECT source_id FROM relationships "
                "  UNION SELECT target_id FROM relationships"
                ") LIMIT 20"
            ).fetchall()
        except Exception:
            return []
        if not rows:
            return []
        return [{
            "type": "orphans",
            "title": f"{len(rows)} Orphan Nodes",
            "description": "Entries không có relationships nào",
            "node_ids": [r[0] for r in rows],
            "severity": "warning",
            "action": {
                "label": "Find Related",
                "endpoint": "api/kb/entries/{id}/find-related",
                "method": "POST",
            },
        }]

    def _find_hubs(self) -> list[dict]:
        """Find nodes with >10 edges (highly connected)."""
        try:
            rows = self._conn.execute(
                "SELECT node_id, cnt FROM ("
                "  SELECT source_id AS node_id, COUNT(*) AS cnt "
                "  FROM relationships GROUP BY source_id "
                "  UNION ALL "
                "  SELECT target_id AS node_id, COUNT(*) AS cnt "
                "  FROM relationships GROUP BY target_id"
                ") GROUP BY node_id HAVING SUM(cnt) > 10 "
                "ORDER BY SUM(cnt) DESC LIMIT 10"
            ).fetchall()
        except Exception:
            return []
        if not rows:
            return []
        return [{
            "type": "hubs",
            "title": f"{len(rows)} Hub Nodes",
            "description": "Entries có >10 relationships (highly connected)",
            "node_ids": [r[0] for r in rows],
            "severity": "info",
            "action": None,
        }]

    def _find_clusters(self) -> list[dict]:
        """Estimate cluster count from connected components."""
        try:
            edges = self._conn.execute(
                "SELECT source_id, target_id FROM relationships"
            ).fetchall()
            nodes = self._conn.execute(
                "SELECT id FROM entries"
            ).fetchall()
        except Exception:
            return []
        if not nodes:
            return []
        node_ids = {r[0] for r in nodes}
        adj = {n: set() for n in node_ids}
        for src, tgt in edges:
            if src in adj and tgt in adj:
                adj[src].add(tgt)
                adj[tgt].add(src)
        components = _count_components(adj)
        if components <= 1:
            return []
        return [{
            "type": "clusters",
            "title": f"{components} Disconnected Clusters",
            "description": "Graph có nhiều components tách biệt",
            "node_ids": [],
            "severity": "info",
            "action": None,
        }]

    def _find_stale_nodes(self) -> list[dict]:
        """Find nodes not updated in >180 days."""
        threshold = (datetime.now() - timedelta(days=180)).isoformat()
        try:
            rows = self._conn.execute(
                "SELECT id, summary FROM entries "
                "WHERE updated_at < ? LIMIT 15",
                (threshold,)
            ).fetchall()
        except Exception:
            return []
        if not rows:
            return []
        return [{
            "type": "stale",
            "title": f"{len(rows)} Stale Nodes (>180 days)",
            "description": "Entries chưa được update > 180 ngày",
            "node_ids": [r[0] for r in rows],
            "severity": "warning",
            "action": {
                "label": "Review",
                "endpoint": "api/kb/entries/{id}/review",
                "method": "POST",
            },
        }]


def _count_components(adj: dict[int, set]) -> int:
    """Count connected components via BFS."""
    visited = set()
    components = 0
    for node in adj:
        if node in visited:
            continue
        components += 1
        queue = [node]
        while queue:
            current = queue.pop(0)
            if current in visited:
                continue
            visited.add(current)
            queue.extend(adj[current] - visited)
    return components
