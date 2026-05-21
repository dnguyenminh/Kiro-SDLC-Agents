"""KSA-70: Staleness Detection & Auto-Archive."""

import sqlite3
from datetime import datetime, timedelta
from typing import Any


# Staleness scoring weights
STALENESS_WEIGHTS = {
    "days_since_access": 0.4,
    "days_since_update": 0.3,
    "days_since_review": 0.3,
}

# Default staleness threshold for auto-archive
DEFAULT_STALE_THRESHOLD = 0.8
DEFAULT_STALE_DAYS = 180


class StalenessDetector:
    """Detect stale entries and auto-archive them."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def detect_stale(self, threshold: float = DEFAULT_STALE_THRESHOLD,
                     limit: int = 50) -> list[dict[str, Any]]:
        """Find entries with staleness score above threshold."""
        self._recompute_staleness()
        cur = self._conn.execute(
            """SELECT id, summary, type, tier, staleness_score,
                      last_accessed_at, updated_at, last_reviewed_at, owner
               FROM knowledge_entries
               WHERE staleness_score >= ? AND archived_at IS NULL
               ORDER BY staleness_score DESC
               LIMIT ?""",
            (threshold, limit),
        )
        return [dict(row) for row in cur.fetchall()]

    def auto_archive(self, threshold: float = DEFAULT_STALE_THRESHOLD,
                     dry_run: bool = False) -> dict[str, Any]:
        """Archive entries exceeding staleness threshold."""
        stale = self.detect_stale(threshold)
        archived = []
        for entry in stale:
            if not dry_run:
                self._archive_entry(entry["id"], "auto:staleness_exceeded")
            archived.append({
                "id": entry["id"],
                "summary": entry["summary"][:80],
                "staleness": entry["staleness_score"],
            })
        return {
            "archived_count": len(archived),
            "entries": archived,
            "threshold": threshold,
            "dry_run": dry_run,
        }

    def unarchive(self, entry_id: int) -> dict[str, Any]:
        """Restore an archived entry."""
        self._conn.execute(
            """UPDATE knowledge_entries
               SET archived_at = NULL, staleness_score = 0.0,
                   updated_at = datetime('now')
               WHERE id = ?""",
            (entry_id,),
        )
        self._conn.commit()
        return {"entry_id": entry_id, "status": "unarchived"}

    def get_due_reviews(self, days: int = 90, limit: int = 20) -> list[dict[str, Any]]:
        """Find entries due for review (not reviewed in N days)."""
        cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
        cur = self._conn.execute(
            """SELECT id, summary, type, tier, owner, reviewer,
                      last_reviewed_at, updated_at
               FROM knowledge_entries
               WHERE archived_at IS NULL
                 AND (last_reviewed_at IS NULL OR last_reviewed_at < ?)
               ORDER BY last_reviewed_at ASC NULLS FIRST
               LIMIT ?""",
            (cutoff, limit),
        )
        return [dict(row) for row in cur.fetchall()]

    def mark_reviewed(self, entry_id: int, reviewer: str | None = None) -> dict[str, Any]:
        """Mark entry as reviewed, reset staleness."""
        now = datetime.utcnow().isoformat()
        self._conn.execute(
            """UPDATE knowledge_entries
               SET last_reviewed_at = ?, staleness_score = 0.0,
                   updated_at = datetime('now')
               WHERE id = ?""",
            (now, entry_id),
        )
        self._conn.commit()
        return {"entry_id": entry_id, "reviewed_at": now, "reviewer": reviewer}

    def _recompute_staleness(self) -> None:
        """Recompute staleness scores for all non-archived entries."""
        now = datetime.utcnow()
        cur = self._conn.execute(
            """SELECT id, last_accessed_at, updated_at, last_reviewed_at
               FROM knowledge_entries WHERE archived_at IS NULL"""
        )
        for row in cur.fetchall():
            score = self._compute_score(row, now)
            self._conn.execute(
                "UPDATE knowledge_entries SET staleness_score = ? WHERE id = ?",
                (score, row["id"]),
            )
        self._conn.commit()

    @staticmethod
    def _compute_score(row: sqlite3.Row, now: datetime) -> float:
        """Compute staleness score (0.0 = fresh, 1.0 = very stale)."""
        def days_since(dt_str: str | None) -> float:
            if not dt_str:
                return DEFAULT_STALE_DAYS
            try:
                dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
                dt = dt.replace(tzinfo=None)
                return (now - dt).days
            except (ValueError, TypeError):
                return DEFAULT_STALE_DAYS

        access_days = days_since(row["last_accessed_at"])
        update_days = days_since(row["updated_at"])
        review_days = days_since(row["last_reviewed_at"])

        # Normalize to 0-1 range (180 days = 1.0)
        norm_access = min(access_days / DEFAULT_STALE_DAYS, 1.0)
        norm_update = min(update_days / DEFAULT_STALE_DAYS, 1.0)
        norm_review = min(review_days / DEFAULT_STALE_DAYS, 1.0)

        score = (
            STALENESS_WEIGHTS["days_since_access"] * norm_access
            + STALENESS_WEIGHTS["days_since_update"] * norm_update
            + STALENESS_WEIGHTS["days_since_review"] * norm_review
        )
        return round(min(score, 1.0), 3)

    def _archive_entry(self, entry_id: int, reason: str) -> None:
        """Archive an entry."""
        now = datetime.utcnow().isoformat()
        self._conn.execute(
            "UPDATE knowledge_entries SET archived_at = ? WHERE id = ?",
            (now, entry_id),
        )
        self._conn.execute(
            """INSERT INTO archive_log (entry_id, reason, auto_archived)
               VALUES (?, ?, 1)""",
            (entry_id, reason),
        )
        self._conn.commit()
