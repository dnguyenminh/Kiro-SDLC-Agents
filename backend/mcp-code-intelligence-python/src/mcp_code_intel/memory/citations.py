"""KSA-79: Citation Tracking & Source Attribution."""

import sqlite3
from typing import Any


class CitationTracker:
    """Track which entries are cited by agents/users."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def cite(self, entry_id: int, cited_by: str,
             context: str | None = None,
             session_id: str | None = None) -> dict[str, Any]:
        """Record a citation of a knowledge entry."""
        cur = self._conn.execute(
            """INSERT INTO citations (entry_id, cited_by, context, session_id)
               VALUES (?, ?, ?, ?)""",
            (entry_id, cited_by, context, session_id),
        )
        self._conn.commit()
        return {
            "citation_id": cur.lastrowid,
            "entry_id": entry_id,
            "cited_by": cited_by,
        }

    def get_citations(self, entry_id: int,
                      limit: int = 20) -> list[dict[str, Any]]:
        """Get all citations for an entry."""
        cur = self._conn.execute(
            """SELECT * FROM citations WHERE entry_id = ?
               ORDER BY cited_at DESC LIMIT ?""",
            (entry_id, limit),
        )
        return [dict(row) for row in cur.fetchall()]

    def get_citation_count(self, entry_id: int) -> int:
        """Get total citation count for an entry."""
        cur = self._conn.execute(
            "SELECT COUNT(*) FROM citations WHERE entry_id = ?", (entry_id,)
        )
        return cur.fetchone()[0]

    def get_most_cited(self, limit: int = 10) -> list[dict[str, Any]]:
        """Get most cited entries."""
        cur = self._conn.execute(
            """SELECT ke.id, ke.summary, ke.type, ke.tier,
                      COUNT(c.id) as citation_count
               FROM citations c
               JOIN knowledge_entries ke ON c.entry_id = ke.id
               GROUP BY ke.id
               ORDER BY citation_count DESC
               LIMIT ?""",
            (limit,),
        )
        return [dict(row) for row in cur.fetchall()]

    def get_citations_by_agent(self, agent: str,
                               limit: int = 20) -> list[dict[str, Any]]:
        """Get citations made by a specific agent."""
        cur = self._conn.execute(
            """SELECT c.*, ke.summary as entry_summary
               FROM citations c
               JOIN knowledge_entries ke ON c.entry_id = ke.id
               WHERE c.cited_by = ?
               ORDER BY c.cited_at DESC LIMIT ?""",
            (agent, limit),
        )
        return [dict(row) for row in cur.fetchall()]

    def get_uncited_entries(self, limit: int = 20) -> list[dict[str, Any]]:
        """Find entries that have never been cited (potential dead content)."""
        cur = self._conn.execute(
            """SELECT ke.id, ke.summary, ke.type, ke.tier, ke.created_at
               FROM knowledge_entries ke
               LEFT JOIN citations c ON ke.id = c.entry_id
               WHERE c.id IS NULL AND ke.archived_at IS NULL
               ORDER BY ke.created_at ASC
               LIMIT ?""",
            (limit,),
        )
        return [dict(row) for row in cur.fetchall()]
