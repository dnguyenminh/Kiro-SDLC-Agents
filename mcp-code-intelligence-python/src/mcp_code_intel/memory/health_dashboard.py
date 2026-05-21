"""KSA-84: KB Health Dashboard & Metrics."""

import sqlite3
from typing import Any


# Health score weights
HEALTH_WEIGHTS = {
    "quality_avg": 0.25,
    "freshness": 0.20,
    "coverage": 0.20,
    "engagement": 0.15,
    "governance": 0.20,
}


class HealthDashboard:
    """KB health metrics and actionable recommendations."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def get_dashboard(self) -> dict[str, Any]:
        """Get full health dashboard with all metrics."""
        metrics = self._compute_metrics()
        health_score = self._compute_health_score(metrics)
        recommendations = self._generate_recommendations(metrics)
        trends = self.get_trends(7)
        return {
            "health_score": health_score,
            "total_entries": metrics["total_entries"],
            "quality_avg": metrics["quality"].get("average", 0),
            "stale_count": metrics["freshness"].get("stale_count", 0),
            "unowned_count": metrics["governance"].get("unowned", 0),
            "recommendations": [
                {"message": r["action"], "priority": r["priority"]}
                for r in recommendations
            ],
            "trends": {
                "search_volume": trends.get("search_volume", {}),
                "ingest_volume": trends.get("ingest_volume", {}),
            },
            "metrics": metrics,
        }

    def get_metrics(self) -> dict[str, Any]:
        """Get raw metrics without recommendations."""
        return self._compute_metrics()

    def get_recommendations(self) -> list[dict[str, Any]]:
        """Get actionable recommendations only."""
        metrics = self._compute_metrics()
        return self._generate_recommendations(metrics)

    def get_trends(self, days: int = 30) -> dict[str, Any]:
        """Get trend data over time period."""
        return {
            "period_days": days,
            "search_volume": self._search_trend(days),
            "ingest_volume": self._ingest_trend(days),
            "quality_trend": self._quality_trend(),
        }

    def _compute_metrics(self) -> dict[str, Any]:
        """Compute all health metrics."""
        return {
            "total_entries": self._count_entries(),
            "archived_entries": self._count_archived(),
            "quality": self._quality_metrics(),
            "freshness": self._freshness_metrics(),
            "coverage": self._coverage_metrics(),
            "engagement": self._engagement_metrics(),
            "governance": self._governance_metrics(),
        }

    def _compute_health_score(self, metrics: dict) -> float:
        """Compute overall health score (0-100)."""
        scores = {
            "quality_avg": metrics["quality"].get("average", 50),
            "freshness": metrics["freshness"].get("fresh_pct", 50),
            "coverage": metrics["coverage"].get("score", 50),
            "engagement": metrics["engagement"].get("score", 50),
            "governance": metrics["governance"].get("score", 50),
        }
        total = sum(scores[k] * HEALTH_WEIGHTS[k] for k in HEALTH_WEIGHTS)
        return round(min(total, 100.0), 1)

    def _generate_recommendations(self, metrics: dict) -> list[dict[str, Any]]:
        """Generate actionable recommendations."""
        recs = []
        quality = metrics["quality"]
        if quality.get("average", 100) < 60:
            recs.append({
                "priority": "high",
                "area": "quality",
                "action": f"Improve {quality.get('low_count', 0)} low-quality entries",
                "impact": "Increases search reliability",
            })

        freshness = metrics["freshness"]
        if freshness.get("stale_pct", 0) > 30:
            recs.append({
                "priority": "high",
                "area": "freshness",
                "action": f"Review {freshness.get('stale_count', 0)} stale entries",
                "impact": "Reduces outdated information",
            })

        governance = metrics["governance"]
        if governance.get("unowned_pct", 0) > 50:
            recs.append({
                "priority": "medium",
                "area": "governance",
                "action": f"Assign owners to {governance.get('unowned', 0)} entries",
                "impact": "Improves accountability",
            })

        engagement = metrics["engagement"]
        if engagement.get("zero_result_rate", 0) > 0.1:
            recs.append({
                "priority": "medium",
                "area": "findability",
                "action": "Address content gaps from zero-result searches",
                "impact": "Improves search success rate",
            })

        coverage = metrics["coverage"]
        if coverage.get("uncited_pct", 0) > 70:
            recs.append({
                "priority": "low",
                "area": "coverage",
                "action": f"Review {coverage.get('uncited', 0)} uncited entries",
                "impact": "May indicate unused content",
            })

        return recs

    def _count_entries(self) -> int:
        """Count active entries."""
        cur = self._conn.execute(
            "SELECT COUNT(*) FROM knowledge_entries WHERE archived_at IS NULL"
        )
        return cur.fetchone()[0]

    def _count_archived(self) -> int:
        """Count archived entries."""
        cur = self._conn.execute(
            "SELECT COUNT(*) FROM knowledge_entries WHERE archived_at IS NOT NULL"
        )
        return cur.fetchone()[0]

    def _quality_metrics(self) -> dict[str, Any]:
        """Get quality-related metrics."""
        cur = self._conn.execute(
            "SELECT AVG(total_score) as avg, COUNT(*) as cnt FROM quality_scores"
        )
        row = cur.fetchone()
        low = self._conn.execute(
            "SELECT COUNT(*) FROM quality_scores WHERE total_score < 40"
        ).fetchone()[0]
        return {
            "average": round(row["avg"] or 0, 1),
            "scored_count": row["cnt"] or 0,
            "low_count": low,
        }

    def _freshness_metrics(self) -> dict[str, Any]:
        """Get freshness-related metrics."""
        total = self._count_entries()
        stale = self._conn.execute(
            """SELECT COUNT(*) FROM knowledge_entries
               WHERE staleness_score >= 0.7 AND archived_at IS NULL"""
        ).fetchone()[0]
        fresh = self._conn.execute(
            """SELECT COUNT(*) FROM knowledge_entries
               WHERE staleness_score < 0.3 AND archived_at IS NULL"""
        ).fetchone()[0]
        return {
            "stale_count": stale,
            "fresh_count": fresh,
            "stale_pct": round(stale / max(total, 1) * 100, 1),
            "fresh_pct": round(fresh / max(total, 1) * 100, 1),
        }

    def _coverage_metrics(self) -> dict[str, Any]:
        """Get coverage metrics (citations, types)."""
        total = self._count_entries()
        uncited = self._conn.execute(
            """SELECT COUNT(*) FROM knowledge_entries ke
               LEFT JOIN citations c ON ke.id = c.entry_id
               WHERE c.id IS NULL AND ke.archived_at IS NULL"""
        ).fetchone()[0]
        score = round((1 - uncited / max(total, 1)) * 100, 1)
        return {
            "uncited": uncited,
            "uncited_pct": round(uncited / max(total, 1) * 100, 1),
            "score": score,
        }

    def _engagement_metrics(self) -> dict[str, Any]:
        """Get engagement metrics."""
        search_total = self._conn.execute(
            "SELECT COUNT(*) FROM search_log"
        ).fetchone()[0]
        zero_results = self._conn.execute(
            "SELECT COUNT(*) FROM search_log WHERE result_count = 0"
        ).fetchone()[0]
        rate = zero_results / max(search_total, 1)
        score = round((1 - rate) * 100, 1)
        return {
            "total_searches": search_total,
            "zero_result_rate": round(rate, 3),
            "score": score,
        }

    def _governance_metrics(self) -> dict[str, Any]:
        """Get governance metrics."""
        total = self._count_entries()
        unowned = self._conn.execute(
            """SELECT COUNT(*) FROM knowledge_entries
               WHERE (owner IS NULL OR owner = '') AND archived_at IS NULL"""
        ).fetchone()[0]
        unreviewed = self._conn.execute(
            """SELECT COUNT(*) FROM knowledge_entries
               WHERE last_reviewed_at IS NULL AND archived_at IS NULL"""
        ).fetchone()[0]
        score = round((1 - unowned / max(total, 1)) * 100, 1)
        return {
            "unowned": unowned,
            "unowned_pct": round(unowned / max(total, 1) * 100, 1),
            "unreviewed": unreviewed,
            "score": score,
        }

    def _search_trend(self, days: int) -> list[dict[str, int]]:
        """Get daily search volume trend as array."""
        cur = self._conn.execute(
            """SELECT DATE(searched_at) as day, COUNT(*) as cnt
               FROM search_log
               WHERE searched_at >= datetime('now', ?)
               GROUP BY DATE(searched_at)
               ORDER BY day""",
            (f"-{days} days",),
        )
        rows = cur.fetchall()
        if rows:
            return [{"count": r["cnt"]} for r in rows]
        return []

    def _ingest_trend(self, days: int) -> list[dict[str, int]]:
        """Get daily ingest volume trend as array."""
        cur = self._conn.execute(
            """SELECT DATE(created_at) as day, COUNT(*) as cnt
               FROM knowledge_entries
               WHERE created_at >= datetime('now', ?)
               GROUP BY DATE(created_at)
               ORDER BY day""",
            (f"-{days} days",),
        )
        rows = cur.fetchall()
        if rows:
            return [{"count": r["cnt"]} for r in rows]
        return []

    def _quality_trend(self) -> dict[str, Any]:
        """Get quality score trend."""
        cur = self._conn.execute(
            "SELECT AVG(total_score) FROM quality_scores"
        )
        return {"current_avg": round(cur.fetchone()[0] or 0, 1)}
