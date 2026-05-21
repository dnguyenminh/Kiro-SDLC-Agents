"""KSA-80: Confidence Scoring for Search Results."""

import sqlite3
from typing import Any


# Signal weights for confidence computation
CONFIDENCE_WEIGHTS = {
    "quality_score": 0.30,
    "citation_count": 0.25,
    "feedback_score": 0.20,
    "freshness": 0.15,
    "access_frequency": 0.10,
}

# Confidence thresholds
CONFIDENCE_LEVELS = {
    "high": 0.8,
    "medium": 0.5,
    "low": 0.3,
    "unreliable": 0.0,
}


class ConfidenceScorer:
    """Compute confidence scores for search results."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def compute_confidence(self, entry_id: int) -> dict[str, Any]:
        """Compute confidence score for a single entry."""
        entry = self._get_entry(entry_id)
        if not entry:
            return {"error": f"Entry {entry_id} not found"}

        signals = self._gather_signals(entry)
        score = self._compute_score(signals)
        level = self._get_level(score)

        self._save_confidence(entry_id, score)
        return {
            "entry_id": entry_id,
            "confidence": score,
            "level": level,
            "signals": signals,
        }

    def batch_compute(self, limit: int = 200) -> dict[str, Any]:
        """Recompute confidence for all active entries."""
        cur = self._conn.execute(
            """SELECT id FROM knowledge_entries
               WHERE archived_at IS NULL
               ORDER BY updated_at DESC LIMIT ?""",
            (limit,),
        )
        computed = 0
        for row in cur.fetchall():
            self.compute_confidence(row["id"])
            computed += 1
        return {"computed_count": computed}

    def filter_by_confidence(self, results: list[dict],
                             min_confidence: float = 0.3) -> list[dict]:
        """Filter search results by minimum confidence."""
        filtered = []
        for r in results:
            entry_id = r.get("entry", {}).get("id") or r.get("id")
            if not entry_id:
                filtered.append(r)
                continue
            conf = self._get_confidence(entry_id)
            r["confidence"] = conf
            if conf >= min_confidence:
                filtered.append(r)
        return filtered

    def get_unreliable(self, limit: int = 20) -> list[dict[str, Any]]:
        """Get entries with low confidence (need attention)."""
        cur = self._conn.execute(
            """SELECT id, summary, type, tier, confidence, owner
               FROM knowledge_entries
               WHERE confidence < 0.3 AND archived_at IS NULL
               ORDER BY confidence ASC LIMIT ?""",
            (limit,),
        )
        return [dict(row) for row in cur.fetchall()]

    def get_confidence_stats(self) -> dict[str, Any]:
        """Get confidence distribution statistics."""
        cur = self._conn.execute(
            """SELECT
                 AVG(confidence) as avg_conf,
                 MIN(confidence) as min_conf,
                 MAX(confidence) as max_conf,
                 COUNT(*) as total
               FROM knowledge_entries WHERE archived_at IS NULL"""
        )
        row = cur.fetchone()
        dist = self._get_distribution()
        return {
            "average": round(row["avg_conf"] or 0, 3),
            "min": round(row["min_conf"] or 0, 3),
            "max": round(row["max_conf"] or 0, 3),
            "total_entries": row["total"] or 0,
            "distribution": dist,
        }

    def _gather_signals(self, entry: dict) -> dict[str, float]:
        """Gather all signals for confidence computation."""
        entry_id = entry["id"]
        return {
            "quality_score": self._get_quality_signal(entry_id),
            "citation_count": self._get_citation_signal(entry_id),
            "feedback_score": self._get_feedback_signal(entry),
            "freshness": self._get_freshness_signal(entry),
            "access_frequency": self._get_access_signal(entry),
        }

    def _compute_score(self, signals: dict[str, float]) -> float:
        """Compute weighted confidence score."""
        score = sum(
            signals[k] * CONFIDENCE_WEIGHTS[k] for k in CONFIDENCE_WEIGHTS
        )
        return round(min(max(score, 0.0), 1.0), 3)

    def _get_quality_signal(self, entry_id: int) -> float:
        """Get normalized quality score (0-1)."""
        cur = self._conn.execute(
            "SELECT total_score FROM quality_scores WHERE entry_id = ?",
            (entry_id,),
        )
        row = cur.fetchone()
        if not row:
            return 0.5  # Default if not scored
        return min(row["total_score"] / 100.0, 1.0)

    def _get_citation_signal(self, entry_id: int) -> float:
        """Get normalized citation signal (0-1)."""
        cur = self._conn.execute(
            "SELECT COUNT(*) FROM citations WHERE entry_id = ?",
            (entry_id,),
        )
        count = cur.fetchone()[0]
        if count >= 10:
            return 1.0
        return count / 10.0

    @staticmethod
    def _get_feedback_signal(entry: dict) -> float:
        """Get normalized feedback signal (0-1)."""
        score = entry.get("feedback_score", 0.0)
        # feedback_score is -1 to 1, normalize to 0-1
        return (score + 1.0) / 2.0

    @staticmethod
    def _get_freshness_signal(entry: dict) -> float:
        """Get freshness signal (0-1)."""
        from datetime import datetime
        updated = entry.get("updated_at", "")
        if not updated:
            return 0.3
        try:
            dt = datetime.fromisoformat(updated.replace("Z", "+00:00"))
            dt = dt.replace(tzinfo=None)
            days = (datetime.utcnow() - dt).days
            if days <= 7:
                return 1.0
            if days <= 30:
                return 0.8
            if days <= 90:
                return 0.6
            if days <= 180:
                return 0.4
            return 0.2
        except (ValueError, TypeError):
            return 0.3

    @staticmethod
    def _get_access_signal(entry: dict) -> float:
        """Get access frequency signal (0-1)."""
        access = entry.get("access_count", 0)
        if access >= 50:
            return 1.0
        return min(access / 50.0, 1.0)

    def _get_confidence(self, entry_id: int) -> float:
        """Get stored confidence for an entry."""
        cur = self._conn.execute(
            "SELECT confidence FROM knowledge_entries WHERE id = ?",
            (entry_id,),
        )
        row = cur.fetchone()
        return row["confidence"] if row else 0.5

    def _save_confidence(self, entry_id: int, score: float) -> None:
        """Save confidence score to entry."""
        self._conn.execute(
            "UPDATE knowledge_entries SET confidence = ? WHERE id = ?",
            (score, entry_id),
        )
        self._conn.commit()

    @staticmethod
    def _get_level(score: float) -> str:
        """Get confidence level from score."""
        for level, threshold in CONFIDENCE_LEVELS.items():
            if score >= threshold:
                return level
        return "unreliable"

    def _get_distribution(self) -> dict[str, int]:
        """Get confidence distribution."""
        dist = {}
        for level, threshold in CONFIDENCE_LEVELS.items():
            upper = 1.1 if level == "high" else threshold + 0.2
            cur = self._conn.execute(
                """SELECT COUNT(*) FROM knowledge_entries
                   WHERE confidence >= ? AND confidence < ?
                   AND archived_at IS NULL""",
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
