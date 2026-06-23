"""KSA-74: Content Quality Scoring & Validation."""

import re
import sqlite3
from typing import Any


# Quality dimension weights
QUALITY_WEIGHTS = {
    "completeness": 0.30,
    "structure": 0.20,
    "freshness": 0.20,
    "engagement": 0.15,
    "metadata": 0.15,
}

# Minimum thresholds for quality levels
QUALITY_LEVELS = {
    "excellent": 80,
    "good": 60,
    "fair": 40,
    "poor": 20,
    "critical": 0,
}


class QualityScorer:
    """Score and validate content quality for knowledge entries."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def score_entry(self, entry_id: int) -> dict[str, Any]:
        """Compute quality score for a single entry."""
        entry = self._get_entry(entry_id)
        if not entry:
            return {"error": f"Entry {entry_id} not found"}

        dimensions = self._compute_dimensions(entry)
        total = sum(
            dimensions[k] * QUALITY_WEIGHTS[k] for k in QUALITY_WEIGHTS
        )
        total = round(min(total, 100.0), 1)
        level = self._get_level(total)

        self._save_score(entry_id, total, dimensions)
        return {
            "entry_id": entry_id,
            "score": total,
            "level": level,
            "dimensions": dimensions,
        }

    def score_all(self, limit: int = 100) -> dict[str, Any]:
        """Score all unscored or stale-scored entries."""
        cur = self._conn.execute(
            """SELECT id FROM knowledge_entries
               WHERE archived_at IS NULL
               ORDER BY updated_at DESC LIMIT ?""",
            (limit,),
        )
        scored = 0
        total_score = 0.0
        for row in cur.fetchall():
            result = self.score_entry(row["id"])
            if "score" in result:
                scored += 1
                total_score += result["score"]
        avg = round(total_score / max(scored, 1), 1)
        return {"scored_count": scored, "average_score": avg}

    def get_low_quality(self, threshold: int = 40,
                        limit: int = 20) -> list[dict[str, Any]]:
        """Get entries below quality threshold."""
        cur = self._conn.execute(
            """SELECT qs.*, ke.summary, ke.type, ke.tier, ke.owner
               FROM quality_scores qs
               JOIN knowledge_entries ke ON qs.entry_id = ke.id
               WHERE qs.total_score < ? AND ke.archived_at IS NULL
               ORDER BY qs.total_score ASC LIMIT ?""",
            (threshold, limit),
        )
        return [dict(row) for row in cur.fetchall()]

    def get_quality_stats(self) -> dict[str, Any]:
        """Get overall quality statistics."""
        cur = self._conn.execute(
            """SELECT
                 COUNT(*) as total,
                 AVG(total_score) as avg_score,
                 MIN(total_score) as min_score,
                 MAX(total_score) as max_score
               FROM quality_scores"""
        )
        row = cur.fetchone()
        dist = self._get_distribution()
        return {
            "total_scored": row["total"] or 0,
            "average_score": round(row["avg_score"] or 0, 1),
            "min_score": round(row["min_score"] or 0, 1),
            "max_score": round(row["max_score"] or 0, 1),
            "distribution": dist,
        }

    def validate_content(self, content: str, type_: str) -> dict[str, Any]:
        """Pre-ingest quality validation."""
        issues = []
        if len(content.strip()) < 50:
            issues.append("Content too short (min 50 chars)")
        if not re.search(r"[.!?]", content):
            issues.append("No sentence-ending punctuation")
        if len(content.split()) < 10:
            issues.append("Fewer than 10 words")
        score = max(0, 100 - len(issues) * 25)
        return {
            "valid": len(issues) == 0,
            "score": score,
            "issues": issues,
        }

    def _compute_dimensions(self, entry: dict) -> dict[str, float]:
        """Compute individual quality dimensions."""
        return {
            "completeness": self._score_completeness(entry),
            "structure": self._score_structure(entry),
            "freshness": self._score_freshness(entry),
            "engagement": self._score_engagement(entry),
            "metadata": self._score_metadata(entry),
        }

    @staticmethod
    def _score_completeness(entry: dict) -> float:
        """Score based on content length and depth."""
        content = entry.get("content", "")
        word_count = len(content.split())
        if word_count >= 200:
            return 100.0
        if word_count >= 100:
            return 80.0
        if word_count >= 50:
            return 60.0
        if word_count >= 20:
            return 40.0
        return 20.0

    @staticmethod
    def _score_structure(entry: dict) -> float:
        """Score based on formatting and organization."""
        content = entry.get("content", "")
        score = 40.0  # Base score
        if re.search(r"^#+\s", content, re.MULTILINE):
            score += 20.0
        if re.search(r"^[-*]\s", content, re.MULTILINE):
            score += 15.0
        if re.search(r"```", content):
            score += 15.0
        if re.search(r"\n\n", content):
            score += 10.0
        return min(score, 100.0)

    @staticmethod
    def _score_freshness(entry: dict) -> float:
        """Score based on recency of updates."""
        from datetime import datetime
        updated = entry.get("updated_at", "")
        if not updated:
            return 30.0
        try:
            dt = datetime.fromisoformat(updated.replace("Z", "+00:00"))
            dt = dt.replace(tzinfo=None)
            days = (datetime.utcnow() - dt).days
            if days <= 7:
                return 100.0
            if days <= 30:
                return 80.0
            if days <= 90:
                return 60.0
            if days <= 180:
                return 40.0
            return 20.0
        except (ValueError, TypeError):
            return 30.0

    @staticmethod
    def _score_engagement(entry: dict) -> float:
        """Score based on access count and citations."""
        access = entry.get("access_count", 0)
        if access >= 20:
            return 100.0
        if access >= 10:
            return 80.0
        if access >= 5:
            return 60.0
        if access >= 2:
            return 40.0
        return 20.0

    @staticmethod
    def _score_metadata(entry: dict) -> float:
        """Score based on metadata completeness."""
        score = 0.0
        if entry.get("tags"):
            score += 25.0
        if entry.get("source"):
            score += 25.0
        if entry.get("owner"):
            score += 25.0
        if entry.get("summary") and len(entry["summary"]) > 10:
            score += 25.0
        return score

    @staticmethod
    def _get_level(score: float) -> str:
        """Get quality level from score."""
        for level, threshold in QUALITY_LEVELS.items():
            if score >= threshold:
                return level
        return "critical"

    def _save_score(self, entry_id: int, total: float,
                    dimensions: dict) -> None:
        """Save quality score to DB."""
        import json
        dims_json = json.dumps(dimensions)
        self._conn.execute(
            """INSERT OR REPLACE INTO quality_scores
               (entry_id, total_score, dimensions, scored_at)
               VALUES (?, ?, ?, datetime('now'))""",
            (entry_id, total, dims_json),
        )
        self._conn.commit()

    def _get_distribution(self) -> dict[str, int]:
        """Get score distribution by level."""
        dist = {}
        for level, threshold in QUALITY_LEVELS.items():
            upper = 100 if level == "excellent" else threshold + 20
            cur = self._conn.execute(
                """SELECT COUNT(*) FROM quality_scores
                   WHERE total_score >= ? AND total_score < ?""",
                (threshold, upper),
            )
            dist[level] = cur.fetchone()[0]
        return dist

    def _get_entry(self, entry_id: int) -> dict[str, Any] | None:
        """Get entry by ID."""
        cur = self._conn.execute(
            "SELECT * FROM knowledge_entries WHERE id = ?", (entry_id,)
        )
        row = cur.fetchone()
        return dict(row) if row else None
