"""KSA-81: Feedback Loop (Thumbs Up/Down)."""

import sqlite3
from typing import Any


class FeedbackManager:
    """Collect and apply user/AI feedback on knowledge entries."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def submit_feedback(self, entry_id: int, rating: int,
                        comment: str | None = None,
                        user_id: str | None = None,
                        session_id: str | None = None) -> dict[str, Any]:
        """Submit feedback (rating: +1 thumbs up, -1 thumbs down)."""
        if rating not in (-1, 1):
            return {"error": "Rating must be -1 or 1"}

        self._conn.execute(
            """INSERT INTO entry_feedback
               (entry_id, rating, comment, user_id, session_id)
               VALUES (?, ?, ?, ?, ?)""",
            (entry_id, rating, comment, user_id, session_id),
        )
        self._update_feedback_score(entry_id)
        self._conn.commit()
        return {
            "entry_id": entry_id,
            "rating": "👍" if rating == 1 else "👎",
            "new_score": self._get_feedback_score(entry_id),
        }

    def get_feedback(self, entry_id: int,
                     limit: int = 20) -> list[dict[str, Any]]:
        """Get all feedback for an entry."""
        cur = self._conn.execute(
            """SELECT * FROM entry_feedback WHERE entry_id = ?
               ORDER BY created_at DESC LIMIT ?""",
            (entry_id, limit),
        )
        return [dict(row) for row in cur.fetchall()]

    def get_feedback_summary(self, entry_id: int) -> dict[str, Any]:
        """Get feedback summary for an entry."""
        cur = self._conn.execute(
            """SELECT
                 COUNT(*) as total,
                 SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as positive,
                 SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END) as negative
               FROM entry_feedback WHERE entry_id = ?""",
            (entry_id,),
        )
        row = cur.fetchone()
        total = row["total"] or 0
        positive = row["positive"] or 0
        negative = row["negative"] or 0
        score = self._get_feedback_score(entry_id)
        return {
            "entry_id": entry_id,
            "total_feedback": total,
            "positive": positive,
            "negative": negative,
            "score": score,
            "sentiment": "positive" if score > 0 else ("negative" if score < 0 else "neutral"),
        }

    def get_low_rated(self, limit: int = 10) -> list[dict[str, Any]]:
        """Get entries with lowest feedback scores."""
        cur = self._conn.execute(
            """SELECT id, summary, type, tier, feedback_score
               FROM knowledge_entries
               WHERE feedback_score < 0 AND archived_at IS NULL
               ORDER BY feedback_score ASC
               LIMIT ?""",
            (limit,),
        )
        return [dict(row) for row in cur.fetchall()]

    def get_top_rated(self, limit: int = 10) -> list[dict[str, Any]]:
        """Get entries with highest feedback scores."""
        cur = self._conn.execute(
            """SELECT id, summary, type, tier, feedback_score
               FROM knowledge_entries
               WHERE feedback_score > 0 AND archived_at IS NULL
               ORDER BY feedback_score DESC
               LIMIT ?""",
            (limit,),
        )
        return [dict(row) for row in cur.fetchall()]

    def _update_feedback_score(self, entry_id: int) -> None:
        """Recompute feedback score (Wilson score interval)."""
        cur = self._conn.execute(
            """SELECT
                 SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as pos,
                 SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END) as neg
               FROM entry_feedback WHERE entry_id = ?""",
            (entry_id,),
        )
        row = cur.fetchone()
        pos = row["pos"] or 0
        neg = row["neg"] or 0
        total = pos + neg
        if total == 0:
            score = 0.0
        else:
            # Simple normalized score: (pos - neg) / total
            score = round((pos - neg) / total, 3)

        self._conn.execute(
            "UPDATE knowledge_entries SET feedback_score = ? WHERE id = ?",
            (score, entry_id),
        )

    def _get_feedback_score(self, entry_id: int) -> float:
        """Get current feedback score."""
        cur = self._conn.execute(
            "SELECT feedback_score FROM knowledge_entries WHERE id = ?",
            (entry_id,),
        )
        row = cur.fetchone()
        return row["feedback_score"] if row else 0.0
