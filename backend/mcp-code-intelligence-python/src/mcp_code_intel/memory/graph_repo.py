"""GraphRepository — CRUD for knowledge graph edges."""

import sqlite3
from typing import Any


class GraphRepository:
    """SQLite persistence for knowledge graph edges."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def add_edge(self, source_id: int, target_id: int,
                 relation: str = "RELATES_TO", weight: float = 1.0) -> int:
        """Add an edge between two entries. Returns edge ID."""
        cur = self._conn.execute(
            """INSERT INTO knowledge_graph_edges (source_id, target_id, relation, weight)
               VALUES (?, ?, ?, ?)""",
            (source_id, target_id, relation, weight),
        )
        self._conn.commit()
        return cur.lastrowid  # type: ignore[return-value]

    def find_all(self, limit: int = 10000) -> list[dict[str, Any]]:
        """Get all edges (for loading graph into memory)."""
        cur = self._conn.execute(
            "SELECT * FROM knowledge_graph_edges LIMIT ?", (limit,)
        )
        return [dict(r) for r in cur.fetchall()]

    def count_edges(self) -> int:
        """Count total edges."""
        cur = self._conn.execute("SELECT COUNT(*) FROM knowledge_graph_edges")
        return cur.fetchone()[0]
