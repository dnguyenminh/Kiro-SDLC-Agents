"""Recommendation engine — generates prioritized KB improvement suggestions."""

import sqlite3
from datetime import datetime, timedelta
from typing import Any


class RecommendationEngine:
    """Analyzes KB data and generates actionable recommendations."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def get_recommendations(self, limit: int = 10) -> dict[str, Any]:
        """Generate all recommendations, sorted by severity."""
        recs: list[dict] = []
        recs.extend(self._find_stale_entries())
        recs.extend(self._find_untagged_entries())
        recs.extend(self._find_low_quality())
        recs.extend(self._find_orphan_entries())
        recs.sort(key=lambda r: _severity_order(r["severity"]))
        return {"recommendations": recs[:limit], "total": len(recs)}

    def _find_stale_entries(self) -> list[dict]:
        """Find entries not updated in >90 days."""
        threshold = (datetime.now() - timedelta(days=90)).isoformat()
        try:
            rows = self._conn.execute(
                "SELECT id, summary, type, updated_at FROM entries "
                "WHERE updated_at < ? ORDER BY updated_at ASC LIMIT 20",
                (threshold,)
            ).fetchall()
        except Exception:
            return []
        return [_build_stale_rec(r) for r in rows]

    def _find_untagged_entries(self) -> list[dict]:
        """Find entries with no tags assigned."""
        try:
            rows = self._conn.execute(
                "SELECT e.id, e.summary, e.type FROM entries e "
                "WHERE (e.tags IS NULL OR e.tags = '') "
                "ORDER BY e.created_at DESC LIMIT 15"
            ).fetchall()
        except Exception:
            return []
        return [_build_untag_rec(r) for r in rows]

    def _find_low_quality(self) -> list[dict]:
        """Find entries with quality score < 40."""
        try:
            rows = self._conn.execute(
                "SELECT id, summary, type, quality_score FROM entries "
                "WHERE quality_score IS NOT NULL AND quality_score < 40 "
                "ORDER BY quality_score ASC LIMIT 10"
            ).fetchall()
        except Exception:
            return []
        return [_build_quality_rec(r) for r in rows]

    def _find_orphan_entries(self) -> list[dict]:
        """Find entries with no relationships."""
        try:
            rows = self._conn.execute(
                "SELECT e.id, e.summary, e.type FROM entries e "
                "WHERE e.id NOT IN ("
                "  SELECT source_id FROM relationships "
                "  UNION SELECT target_id FROM relationships"
                ") ORDER BY e.created_at DESC LIMIT 10"
            ).fetchall()
        except Exception:
            return []
        return [_build_orphan_rec(r) for r in rows]


def _build_stale_rec(row: tuple) -> dict:
    """Build a stale entry recommendation."""
    entry_id, summary, etype, updated = row[0], row[1], row[2], row[3]
    return {
        "id": f"rec-stale-{entry_id}",
        "type": "stale",
        "severity": "high",
        "title": f"Entry #{entry_id} chưa review > 90 ngày",
        "description": f"[{etype}] {summary[:80]}",
        "entry_id": entry_id,
        "action": {
            "label": "Mark Reviewed",
            "endpoint": f"api/kb/entries/{entry_id}/review",
            "method": "POST",
            "confirm": False,
        },
    }


def _build_untag_rec(row: tuple) -> dict:
    """Build an untagged entry recommendation."""
    entry_id, summary, etype = row[0], row[1], row[2]
    return {
        "id": f"rec-untag-{entry_id}",
        "type": "untagged",
        "severity": "medium",
        "title": f"Entry #{entry_id} chưa có tags",
        "description": f"[{etype}] {summary[:80]}",
        "entry_id": entry_id,
        "action": {
            "label": "Auto-Tag",
            "endpoint": f"api/kb/entries/{entry_id}/auto-tag",
            "method": "POST",
            "confirm": False,
        },
    }


def _build_quality_rec(row: tuple) -> dict:
    """Build a low quality recommendation."""
    entry_id, summary, etype = row[0], row[1], row[2]
    score = row[3] if len(row) > 3 else 0
    return {
        "id": f"rec-quality-{entry_id}",
        "type": "low_quality",
        "severity": "medium",
        "title": f"Entry #{entry_id} quality score thấp ({score})",
        "description": f"[{etype}] {summary[:80]}",
        "entry_id": entry_id,
        "action": None,
    }


def _build_orphan_rec(row: tuple) -> dict:
    """Build an orphan entry recommendation."""
    entry_id, summary, etype = row[0], row[1], row[2]
    return {
        "id": f"rec-orphan-{entry_id}",
        "type": "orphan",
        "severity": "low",
        "title": f"Entry #{entry_id} không có relationships",
        "description": f"[{etype}] {summary[:80]}",
        "entry_id": entry_id,
        "action": {
            "label": "Find Related",
            "endpoint": f"api/kb/entries/{entry_id}/find-related",
            "method": "POST",
            "confirm": False,
        },
    }


def _severity_order(severity: str) -> int:
    """Sort order: high=0, medium=1, low=2."""
    return {"high": 0, "medium": 1, "low": 2}.get(severity, 3)
