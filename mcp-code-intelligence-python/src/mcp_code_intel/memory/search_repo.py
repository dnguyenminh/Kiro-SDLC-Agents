"""KnowledgeSearchRepository — FTS5 full-text search for knowledge entries."""

import re
import sqlite3
from typing import Any


class KnowledgeSearchRepository:
    """FTS5 search across knowledge entries."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def search(self, query: str, limit: int = 20) -> list[dict[str, Any]]:
        """Full-text search using FTS5."""
        fts_query = self._sanitize_query(query)
        cur = self._conn.execute(
            """SELECT ke.*, rank
               FROM knowledge_fts
               JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id
               WHERE knowledge_fts MATCH ?
               ORDER BY rank
               LIMIT ?""",
            (fts_query, limit),
        )
        return [self._to_result(row) for row in cur.fetchall()]

    def search_in_tier(self, query: str, tier: str, limit: int = 20) -> list[dict[str, Any]]:
        """Search within a specific tier."""
        fts_query = self._sanitize_query(query)
        cur = self._conn.execute(
            """SELECT ke.*, rank
               FROM knowledge_fts
               JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id
               WHERE knowledge_fts MATCH ? AND ke.tier = ?
               ORDER BY rank
               LIMIT ?""",
            (fts_query, tier, limit),
        )
        return [self._to_result(row) for row in cur.fetchall()]

    def _sanitize_query(self, query: str) -> str:
        """Remove special chars that break FTS5 syntax."""
        cleaned = re.sub(r'[^\w\s*":.]+', " ", query).strip()
        return cleaned or "*"

    def _to_result(self, row: sqlite3.Row) -> dict[str, Any]:
        """Convert row to search result dict."""
        d = dict(row)
        score = -d.pop("rank", 0)
        return {"entry": d, "score": score, "match_type": "fts"}
