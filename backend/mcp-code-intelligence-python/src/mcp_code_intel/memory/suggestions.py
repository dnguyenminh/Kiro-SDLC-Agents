"""KSA-76: Auto-Suggestions & Related Entries."""

import sqlite3
from typing import Any


class SuggestionEngine:
    """Auto-suggestions and related entry recommendations."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def suggest(self, query: str, limit: int = 5) -> list[dict[str, Any]]:
        """Type-ahead suggestions based on partial query."""
        if not query or len(query) < 2:
            return []
        prefix = f"{query}*"
        cur = self._conn.execute(
            """SELECT ke.id, ke.summary, ke.type, ke.tier, ke.tags
               FROM knowledge_fts
               JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id
               WHERE knowledge_fts MATCH ?
                 AND ke.archived_at IS NULL
               ORDER BY ke.access_count DESC
               LIMIT ?""",
            (prefix, limit),
        )
        return [dict(row) for row in cur.fetchall()]

    def get_related(self, entry_id: int, limit: int = 5) -> list[dict[str, Any]]:
        """Get related entries using multiple signals."""
        # Check cache first
        cached = self._get_cached_related(entry_id, limit)
        if cached:
            return cached

        # Compute related entries
        related = self._compute_related(entry_id, limit)
        self._cache_related(entry_id, related)
        return related

    def refresh_related(self, entry_id: int, limit: int = 5) -> list[dict[str, Any]]:
        """Force recompute related entries."""
        self._clear_cache(entry_id)
        related = self._compute_related(entry_id, limit)
        self._cache_related(entry_id, related)
        return related

    def _compute_related(self, entry_id: int, limit: int) -> list[dict[str, Any]]:
        """Compute related entries using tags + graph + FTS."""
        entry = self._get_entry(entry_id)
        if not entry:
            return []

        scores: dict[int, float] = {}

        # Signal 1: Same tags (weight 0.4)
        self._score_by_tags(entry, scores)
        # Signal 2: Graph neighbors (weight 0.3)
        self._score_by_graph(entry_id, scores)
        # Signal 3: FTS similarity (weight 0.3)
        self._score_by_fts(entry, scores)

        # Remove self
        scores.pop(entry_id, None)

        # Sort and return top N
        sorted_ids = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:limit]
        results = []
        for rid, score in sorted_ids:
            related = self._get_entry(rid)
            if related:
                results.append({
                    "id": rid,
                    "summary": related["summary"],
                    "type": related["type"],
                    "tier": related["tier"],
                    "score": round(score, 3),
                })
        return results

    def _score_by_tags(self, entry: dict, scores: dict[int, float]) -> None:
        """Score entries sharing tags."""
        tags = [t.strip() for t in entry.get("tags", "").split(",") if t.strip()]
        if not tags:
            return
        placeholders = ",".join("?" * len(tags))
        cur = self._conn.execute(
            f"""SELECT id FROM knowledge_entries
                WHERE id != ? AND archived_at IS NULL
                AND ({' OR '.join(f"tags LIKE ?" for _ in tags)})""",
            [entry["id"]] + [f"%{t}%" for t in tags],
        )
        for row in cur.fetchall():
            scores[row["id"]] = scores.get(row["id"], 0) + 0.4

    def _score_by_graph(self, entry_id: int, scores: dict[int, float]) -> None:
        """Score graph neighbors."""
        cur = self._conn.execute(
            """SELECT target_id FROM knowledge_graph_edges WHERE source_id = ?
               UNION
               SELECT source_id FROM knowledge_graph_edges WHERE target_id = ?""",
            (entry_id, entry_id),
        )
        for row in cur.fetchall():
            nid = row[0]
            scores[nid] = scores.get(nid, 0) + 0.3

    def _score_by_fts(self, entry: dict, scores: dict[int, float]) -> None:
        """Score by FTS similarity using summary keywords."""
        words = entry.get("summary", "").split()[:5]
        if not words:
            return
        query = " OR ".join(w for w in words if len(w) > 3)
        if not query:
            return
        try:
            cur = self._conn.execute(
                """SELECT ke.id
                   FROM knowledge_fts
                   JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id
                   WHERE knowledge_fts MATCH ? AND ke.id != ?
                     AND ke.archived_at IS NULL
                   LIMIT 10""",
                (query, entry["id"]),
            )
            for row in cur.fetchall():
                scores[row["id"]] = scores.get(row["id"], 0) + 0.3
        except Exception:
            pass  # FTS query may fail on special chars

    def _get_cached_related(self, entry_id: int, limit: int) -> list[dict[str, Any]]:
        """Get cached related entries."""
        cur = self._conn.execute(
            """SELECT rc.related_id, rc.score, ke.summary, ke.type, ke.tier
               FROM related_entries_cache rc
               JOIN knowledge_entries ke ON rc.related_id = ke.id
               WHERE rc.entry_id = ?
               ORDER BY rc.score DESC LIMIT ?""",
            (entry_id, limit),
        )
        rows = cur.fetchall()
        if not rows:
            return []
        return [{"id": r["related_id"], "summary": r["summary"],
                 "type": r["type"], "tier": r["tier"],
                 "score": r["score"]} for r in rows]

    def _cache_related(self, entry_id: int, related: list[dict]) -> None:
        """Cache computed related entries."""
        self._clear_cache(entry_id)
        for r in related:
            self._conn.execute(
                """INSERT OR REPLACE INTO related_entries_cache
                   (entry_id, related_id, score, method)
                   VALUES (?, ?, ?, 'hybrid')""",
                (entry_id, r["id"], r["score"]),
            )
        self._conn.commit()

    def _clear_cache(self, entry_id: int) -> None:
        """Clear related cache for an entry."""
        self._conn.execute(
            "DELETE FROM related_entries_cache WHERE entry_id = ?", (entry_id,)
        )

    def _get_entry(self, entry_id: int) -> dict[str, Any] | None:
        """Get entry by ID."""
        cur = self._conn.execute(
            "SELECT * FROM knowledge_entries WHERE id = ?", (entry_id,)
        )
        row = cur.fetchone()
        return dict(row) if row else None
