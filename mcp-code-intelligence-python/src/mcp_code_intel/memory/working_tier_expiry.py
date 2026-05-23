"""WorkingTierExpiry — lazy auto-expiry of stale WORKING tier entries.

Runs on every mem_search call (no background threads).
Entries older than expiry_hours are promoted (quality >= 60) or archived.
Pinned entries are exempt from expiry (BR-F1-05).
"""

import logging
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)


@dataclass
class ExpiryAction:
    """Action taken on a stale entry."""

    entry_id: int
    action: str  # "promoted" or "archived"
    quality_score: int
    to_tier: str | None = None


class WorkingTierExpiry:
    """Lazy auto-expiry of stale WORKING tier entries."""

    def __init__(
        self,
        conn: sqlite3.Connection,
        expiry_hours: int = 24,
        promote_threshold: int = 60,
    ) -> None:
        self._conn = conn
        self._expiry_hours = expiry_hours
        self._promote_threshold = promote_threshold

    def process_stale(self) -> list[ExpiryAction]:
        """Process stale WORKING entries. Returns actions taken."""
        stale = self._get_stale_entries()
        if not stale:
            return []

        actions: list[ExpiryAction] = []
        cursor = self._conn.cursor()

        try:
            for entry_id, score in stale:
                if score >= self._promote_threshold:
                    cursor.execute(
                        "UPDATE knowledge_entries SET tier = 'EPISODIC', "
                        "updated_at = datetime('now') WHERE id = ?",
                        (entry_id,),
                    )
                    actions.append(ExpiryAction(entry_id, "promoted", score, "EPISODIC"))
                else:
                    cursor.execute(
                        "UPDATE knowledge_entries SET archived = 1, "
                        "updated_at = datetime('now') WHERE id = ?",
                        (entry_id,),
                    )
                    actions.append(ExpiryAction(entry_id, "archived", score))
            self._conn.commit()
        except Exception:
            self._conn.rollback()
            raise

        if actions:
            logger.info("WorkingTierExpiry: %d entries processed", len(actions))
        return actions

    def _get_stale_entries(self) -> list[tuple[int, int]]:
        """Find WORKING entries older than expiry_hours, excluding pinned."""
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=self._expiry_hours)).isoformat()
        cursor = self._conn.cursor()
        cursor.execute(
            """SELECT id, quality_score FROM knowledge_entries
               WHERE tier = 'WORKING'
                 AND archived = 0
                 AND pinned = 0
                 AND created_at < ?
               ORDER BY created_at ASC
               LIMIT 100""",
            (cutoff,),
        )
        return [(row[0], row[1] or 0) for row in cursor.fetchall()]
