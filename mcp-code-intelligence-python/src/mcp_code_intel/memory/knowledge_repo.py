"""KnowledgeRepository — CRUD operations for knowledge entries."""

import sqlite3
from typing import Any


class KnowledgeRepository:
    """CRUD for knowledge_entries table."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def insert(self, content: str, summary: str, type_: str,
               tier: str = "WORKING", source: str | None = None,
               tags: str = "") -> int:
        """Insert a new entry, returns generated ID."""
        cur = self._conn.execute(
            """INSERT INTO knowledge_entries
               (content, summary, type, tier, source, tags, confidence)
               VALUES (?, ?, ?, ?, ?, ?, 1.0)""",
            (content, summary, type_, tier, source, tags),
        )
        self._conn.commit()
        return cur.lastrowid  # type: ignore[return-value]

    def find_by_id(self, entry_id: int) -> dict[str, Any] | None:
        """Find entry by ID."""
        cur = self._conn.execute(
            "SELECT * FROM knowledge_entries WHERE id = ?", (entry_id,)
        )
        row = cur.fetchone()
        return dict(row) if row else None

    def find_by_tier(self, tier: str, limit: int = 100) -> list[dict[str, Any]]:
        """Find entries by tier."""
        cur = self._conn.execute(
            "SELECT * FROM knowledge_entries WHERE tier = ? ORDER BY updated_at DESC LIMIT ?",
            (tier, limit),
        )
        return [dict(r) for r in cur.fetchall()]

    def find_all(self, limit: int = 500) -> list[dict[str, Any]]:
        """Find all entries (for graph visualization)."""
        cur = self._conn.execute(
            "SELECT * FROM knowledge_entries ORDER BY id DESC LIMIT ?",
            (limit,),
        )
        return [dict(r) for r in cur.fetchall()]

    def find_by_type(self, type_: str, limit: int = 100) -> list[dict[str, Any]]:
        """Find entries by type."""
        cur = self._conn.execute(
            "SELECT * FROM knowledge_entries WHERE type = ? ORDER BY updated_at DESC LIMIT ?",
            (type_, limit),
        )
        return [dict(r) for r in cur.fetchall()]

    def update_tier(self, entry_id: int, new_tier: str) -> None:
        """Update tier for an entry."""
        self._conn.execute(
            "UPDATE knowledge_entries SET tier = ?, updated_at = datetime('now') WHERE id = ?",
            (new_tier, entry_id),
        )
        self._conn.commit()

    def record_access(self, entry_id: int) -> None:
        """Increment access count and update last_accessed_at."""
        self._conn.execute(
            """UPDATE knowledge_entries
               SET access_count = access_count + 1, last_accessed_at = datetime('now')
               WHERE id = ?""",
            (entry_id,),
        )
        self._conn.commit()

    def delete(self, entry_id: int) -> None:
        """Delete entry by ID."""
        self._conn.execute("DELETE FROM knowledge_entries WHERE id = ?", (entry_id,))
        self._conn.commit()
