"""KSA-84: KB Health Dashboard & Metrics.

Uses unified formula consistent across NodeJS/Python/Kotlin:
  total_entries = COUNT(*) FROM knowledge_entries (no filters)
  stale_count = updated_at < -90 days
  unowned_count = source IS NULL OR source = ''
  health_score = qualityAvg * 0.4 + staleRatio * 0.3 + ownedRatio * 0.3
"""

import sqlite3
from typing import Any


class HealthDashboard:
    """KB health metrics and actionable recommendations."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def get_dashboard(self) -> dict[str, Any]:
        """Get full health dashboard with all metrics."""
        total = self._count_entries()
        quality_avg = self._quality_avg()
        stale_count = self._count_stale()
        unowned_count = self._count_unowned()

        stale_ratio = (1 - stale_count / total) * 100 if total > 0 else 100
        owned_ratio = (1 - unowned_count / total) * 100 if total > 0 else 100
        health_score = 0 if total == 0 else round(
            min(quality_avg, 100) * 0.4 + stale_ratio * 0.3 + owned_ratio * 0.3
        )

        recommendations = self._generate_recommendations(
            total, quality_avg, stale_count, unowned_count
        )
        trends = self.get_trends(7)

        return {
            "health_score": health_score,
            "total_entries": total,
            "quality_avg": round(min(quality_avg, 100), 1),
            "stale_count": stale_count,
            "unowned_count": unowned_count,
            "recommendations": recommendations,
            "trends": {
                "search_volume": trends.get("search_volume", []),
                "ingest_volume": trends.get("ingest_volume", []),
            },
        }

    def get_metrics(self) -> dict[str, Any]:
        """Get raw metrics."""
        total = self._count_entries()
        quality_avg = self._quality_avg()
        stale_count = self._count_stale()
        unowned_count = self._count_unowned()
        return {
            "total_entries": total,
            "quality_avg": round(quality_avg, 1),
            "stale_count": stale_count,
            "unowned_count": unowned_count,
        }

    def get_recommendations(self) -> list[dict[str, Any]]:
        """Get actionable recommendations only."""
        total = self._count_entries()
        quality_avg = self._quality_avg()
        stale_count = self._count_stale()
        unowned_count = self._count_unowned()
        return self._generate_recommendations(
            total, quality_avg, stale_count, unowned_count
        )

    def get_trends(self, days: int = 30) -> dict[str, Any]:
        """Get trend data over time period."""
        return {
            "period_days": days,
            "search_volume": self._search_trend(days),
            "ingest_volume": self._ingest_trend(days),
        }

    def _generate_recommendations(
        self, total: int, quality_avg: float, stale_count: int, unowned_count: int
    ) -> list[dict[str, Any]]:
        """Generate actionable recommendations."""
        recs: list[dict[str, Any]] = []
        if quality_avg < 60:
            recs.append({
                "priority": "high",
                "message": "Improve low-quality entries",
            })
        if total > 0 and stale_count / total > 0.3:
            recs.append({
                "priority": "high",
                "message": f"Review {stale_count} stale entries",
            })
        if total > 0 and unowned_count / total > 0.5:
            recs.append({
                "priority": "medium",
                "message": f"Assign owners to {unowned_count} entries",
            })
        return recs

    def _count_entries(self) -> int:
        """Count ALL entries (no filters)."""
        cur = self._conn.execute("SELECT COUNT(*) FROM knowledge_entries")
        return cur.fetchone()[0]

    def _count_stale(self) -> int:
        """Count entries not updated in 90+ days."""
        cur = self._conn.execute(
            "SELECT COUNT(*) FROM knowledge_entries "
            "WHERE updated_at < datetime('now', '-90 days')"
        )
        return cur.fetchone()[0]

    def _count_unowned(self) -> int:
        """Count entries without source."""
        cur = self._conn.execute(
            "SELECT COUNT(*) FROM knowledge_entries "
            "WHERE source IS NULL OR source = ''"
        )
        return cur.fetchone()[0]

    def _quality_avg(self) -> float:
        """Get average confidence from knowledge_entries."""
        cur = self._conn.execute(
            "SELECT AVG(confidence) FROM knowledge_entries"
        )
        row = cur.fetchone()
        return row[0] if row and row[0] is not None else 0.0

    def _search_trend(self, days: int) -> list[dict[str, Any]]:
        """Get daily search volume trend."""
        try:
            rows = self._conn.execute(
                "SELECT DATE(searched_at) as date, COUNT(*) as count "
                "FROM search_log "
                "WHERE searched_at >= datetime('now', ?) "
                "GROUP BY DATE(searched_at) ORDER BY date",
                (f"-{days} days",),
            ).fetchall()
            return [{"date": r[0], "count": r[1]} for r in rows]
        except Exception:
            return []

    def _ingest_trend(self, days: int) -> list[dict[str, Any]]:
        """Get daily ingest volume trend."""
        try:
            rows = self._conn.execute(
                "SELECT DATE(created_at) as date, COUNT(*) as count "
                "FROM memory_audit "
                "WHERE operation = 'INGEST' AND created_at >= datetime('now', ?) "
                "GROUP BY DATE(created_at) ORDER BY date",
                (f"-{days} days",),
            ).fetchall()
            return [{"date": r[0], "count": r[1]} for r in rows]
        except Exception:
            return []
