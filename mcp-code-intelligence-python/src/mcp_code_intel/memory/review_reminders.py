"""KSA-72: Scheduled Review Reminders."""

import sqlite3
from datetime import datetime, timedelta
from typing import Any


# Default reminder intervals by tier
REMINDER_INTERVALS = {
    "PROCEDURAL": 30,   # Review every 30 days
    "SEMANTIC": 60,     # Review every 60 days
    "EPISODIC": 90,     # Review every 90 days
    "WORKING": 120,     # Review every 120 days
}


class ReviewReminderEngine:
    """Schedule and manage review reminders for knowledge entries."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def get_due_reminders(self, limit: int = 20) -> list[dict[str, Any]]:
        """Get entries with overdue review reminders."""
        now = datetime.utcnow().isoformat()
        cur = self._conn.execute(
            """SELECT rr.*, ke.summary, ke.type, ke.tier, ke.owner
               FROM review_reminders rr
               JOIN knowledge_entries ke ON rr.entry_id = ke.id
               WHERE rr.next_reminder_at <= ?
                 AND rr.is_active = 1
                 AND ke.archived_at IS NULL
               ORDER BY rr.next_reminder_at ASC
               LIMIT ?""",
            (now, limit),
        )
        return [dict(row) for row in cur.fetchall()]

    def schedule_reminder(self, entry_id: int,
                          interval_days: int | None = None,
                          assignee: str | None = None) -> dict[str, Any]:
        """Schedule a review reminder for an entry."""
        if interval_days is None:
            interval_days = self._get_default_interval(entry_id)

        next_at = (datetime.utcnow() + timedelta(days=interval_days)).isoformat()
        self._conn.execute(
            """INSERT OR REPLACE INTO review_reminders
               (entry_id, interval_days, next_reminder_at, assignee, is_active)
               VALUES (?, ?, ?, ?, 1)""",
            (entry_id, interval_days, next_at, assignee),
        )
        self._conn.commit()
        return {
            "entry_id": entry_id,
            "interval_days": interval_days,
            "next_reminder_at": next_at,
            "assignee": assignee,
        }

    def snooze_reminder(self, entry_id: int,
                        snooze_days: int = 7) -> dict[str, Any]:
        """Snooze a reminder by N days."""
        next_at = (datetime.utcnow() + timedelta(days=snooze_days)).isoformat()
        self._conn.execute(
            """UPDATE review_reminders
               SET next_reminder_at = ?, snooze_count = snooze_count + 1
               WHERE entry_id = ?""",
            (next_at, entry_id),
        )
        self._conn.commit()
        return {"entry_id": entry_id, "snoozed_until": next_at}

    def dismiss_reminder(self, entry_id: int) -> dict[str, Any]:
        """Dismiss (deactivate) a reminder."""
        self._conn.execute(
            "UPDATE review_reminders SET is_active = 0 WHERE entry_id = ?",
            (entry_id,),
        )
        self._conn.commit()
        return {"entry_id": entry_id, "status": "dismissed"}

    def complete_review(self, entry_id: int,
                        reviewer: str | None = None) -> dict[str, Any]:
        """Mark review complete and reschedule next reminder."""
        now = datetime.utcnow().isoformat()
        cur = self._conn.execute(
            "SELECT interval_days FROM review_reminders WHERE entry_id = ?",
            (entry_id,),
        )
        row = cur.fetchone()
        interval = row["interval_days"] if row else self._get_default_interval(entry_id)
        next_at = (datetime.utcnow() + timedelta(days=interval)).isoformat()

        self._conn.execute(
            """UPDATE review_reminders
               SET next_reminder_at = ?, last_reviewed_at = ?,
                   snooze_count = 0
               WHERE entry_id = ?""",
            (next_at, now, entry_id),
        )
        self._conn.execute(
            """UPDATE knowledge_entries
               SET last_reviewed_at = ?, updated_at = datetime('now')
               WHERE id = ?""",
            (now, entry_id),
        )
        self._conn.commit()
        return {
            "entry_id": entry_id,
            "reviewed_at": now,
            "reviewer": reviewer,
            "next_reminder_at": next_at,
        }

    def auto_schedule_all(self) -> dict[str, Any]:
        """Auto-schedule reminders for entries without one."""
        cur = self._conn.execute(
            """SELECT ke.id, ke.tier FROM knowledge_entries ke
               LEFT JOIN review_reminders rr ON ke.id = rr.entry_id
               WHERE rr.id IS NULL AND ke.archived_at IS NULL"""
        )
        scheduled = 0
        for row in cur.fetchall():
            interval = REMINDER_INTERVALS.get(row["tier"], 90)
            self.schedule_reminder(row["id"], interval)
            scheduled += 1
        return {"scheduled_count": scheduled}

    def get_reminder_stats(self) -> dict[str, Any]:
        """Get reminder statistics."""
        total = self._scalar("SELECT COUNT(*) FROM review_reminders WHERE is_active = 1")
        overdue = self._scalar(
            "SELECT COUNT(*) FROM review_reminders WHERE next_reminder_at <= datetime('now') AND is_active = 1"
        )
        snoozed = self._scalar(
            "SELECT COUNT(*) FROM review_reminders WHERE snooze_count > 0 AND is_active = 1"
        )
        return {
            "total_active": total,
            "overdue": overdue,
            "snoozed": snoozed,
            "on_track": total - overdue,
        }

    def _get_default_interval(self, entry_id: int) -> int:
        """Get default interval based on entry tier."""
        cur = self._conn.execute(
            "SELECT tier FROM knowledge_entries WHERE id = ?", (entry_id,)
        )
        row = cur.fetchone()
        tier = row["tier"] if row else "WORKING"
        return REMINDER_INTERVALS.get(tier, 90)

    def _scalar(self, sql: str) -> int:
        """Execute scalar query."""
        cur = self._conn.execute(sql)
        return cur.fetchone()[0] or 0
