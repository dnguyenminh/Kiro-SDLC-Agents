"""KSA-78: Search Analytics & Query Optimization."""

import sqlite3
from typing import Any


class SearchAnalytics:
    """Track search patterns and optimize query performance."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def log_search(self, query: str, result_count: int,
                   top_result_id: int | None = None,
                   session_id: str | None = None) -> None:
        """Log a search query for analytics."""
        self._conn.execute(
            """INSERT INTO search_log (query, result_count, top_result_id, session_id)
               VALUES (?, ?, ?, ?)""",
            (query, result_count, top_result_id, session_id),
        )
        self._update_popular(query, result_count)
        self._conn.commit()

    def log_click(self, query: str, clicked_id: int) -> None:
        """Log when a search result is clicked/accessed."""
        self._conn.execute(
            """UPDATE search_log SET clicked_result_id = ?
               WHERE query = ? AND clicked_result_id IS NULL
               ORDER BY searched_at DESC LIMIT 1""",
            (clicked_id, query),
        )
        self._conn.commit()

    def get_analytics(self) -> dict[str, Any]:
        """Get search analytics summary."""
        total = self._scalar("SELECT COUNT(*) FROM search_log")
        zero_results = self._scalar(
            "SELECT COUNT(*) FROM search_log WHERE result_count = 0"
        )
        avg_results = self._scalar(
            "SELECT AVG(result_count) FROM search_log"
        ) or 0
        click_rate = self._scalar(
            """SELECT CAST(COUNT(clicked_result_id) AS REAL) / NULLIF(COUNT(*), 0)
               FROM search_log"""
        ) or 0

        return {
            "total_searches": total,
            "zero_result_searches": zero_results,
            "zero_result_rate": round(zero_results / max(total, 1), 3),
            "avg_results_per_search": round(avg_results, 1),
            "click_through_rate": round(click_rate, 3),
        }

    def get_popular_queries(self, limit: int = 10) -> list[dict[str, Any]]:
        """Get most popular search queries."""
        cur = self._conn.execute(
            "SELECT * FROM popular_queries ORDER BY hit_count DESC LIMIT ?",
            (limit,),
        )
        return [dict(row) for row in cur.fetchall()]

    def get_zero_result_queries(self, limit: int = 10) -> list[dict[str, Any]]:
        """Get queries that returned zero results (content gaps)."""
        cur = self._conn.execute(
            """SELECT query, COUNT(*) as occurrences,
                      MAX(searched_at) as last_searched
               FROM search_log
               WHERE result_count = 0
               GROUP BY query
               ORDER BY occurrences DESC
               LIMIT ?""",
            (limit,),
        )
        return [dict(row) for row in cur.fetchall()]

    def get_content_gaps(self) -> list[dict[str, Any]]:
        """Identify content gaps from search patterns."""
        gaps = self.get_zero_result_queries(20)
        return [
            {"query": g["query"], "demand": g["occurrences"],
             "last_searched": g["last_searched"],
             "recommendation": f"Create content for: {g['query']}"}
            for g in gaps if g["occurrences"] >= 2
        ]

    def _update_popular(self, query: str, result_count: int) -> None:
        """Update popular queries table."""
        normalized = query.strip().lower()
        cur = self._conn.execute(
            "SELECT id, hit_count, avg_results FROM popular_queries WHERE query = ?",
            (normalized,),
        )
        row = cur.fetchone()
        if row:
            new_avg = (row["avg_results"] * row["hit_count"] + result_count) / (row["hit_count"] + 1)
            self._conn.execute(
                """UPDATE popular_queries
                   SET hit_count = hit_count + 1, avg_results = ?,
                       last_searched = datetime('now')
                   WHERE id = ?""",
                (new_avg, row["id"]),
            )
        else:
            self._conn.execute(
                """INSERT INTO popular_queries (query, hit_count, avg_results)
                   VALUES (?, 1, ?)""",
                (normalized, result_count),
            )

    def _scalar(self, sql: str) -> int | float:
        """Execute scalar query."""
        cur = self._conn.execute(sql)
        row = cur.fetchone()
        return row[0] if row else 0
