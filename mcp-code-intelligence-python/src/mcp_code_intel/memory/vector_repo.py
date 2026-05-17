"""VectorRepository — CRUD for knowledge entry embeddings."""

import sqlite3
from typing import Any


class VectorRepository:
    """Store and retrieve embedding vectors for knowledge entries."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def upsert(self, entry_id: int, vector: bytes, model: str, dimensions: int) -> None:
        """Insert or update embedding vector for an entry."""
        sql = """
            INSERT INTO knowledge_vectors (entry_id, vector, model, dimensions)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(entry_id) DO UPDATE SET
              vector = excluded.vector,
              model = excluded.model,
              dimensions = excluded.dimensions,
              created_at = datetime('now')
        """
        self._conn.execute(sql, (entry_id, vector, model, dimensions))
        self._conn.commit()

    def find_by_entry_id(self, entry_id: int) -> dict[str, Any] | None:
        """Get vector record for an entry."""
        cur = self._conn.execute(
            "SELECT * FROM knowledge_vectors WHERE entry_id = ?", (entry_id,)
        )
        row = cur.fetchone()
        return _row_to_dict(row, cur.description) if row else None

    def find_all(self) -> list[dict[str, Any]]:
        """Get all vectors (for brute-force similarity search)."""
        cur = self._conn.execute("SELECT * FROM knowledge_vectors")
        desc = cur.description
        return [_row_to_dict(row, desc) for row in cur.fetchall()]

    def count(self) -> int:
        """Count total stored vectors."""
        cur = self._conn.execute("SELECT COUNT(*) FROM knowledge_vectors")
        return cur.fetchone()[0]

    def delete(self, entry_id: int) -> None:
        """Delete vector for an entry."""
        self._conn.execute(
            "DELETE FROM knowledge_vectors WHERE entry_id = ?", (entry_id,)
        )
        self._conn.commit()


def _row_to_dict(row: tuple, description: Any) -> dict[str, Any]:
    """Convert sqlite3 row tuple to dict using cursor description."""
    return {col[0]: val for col, val in zip(description, row)}
