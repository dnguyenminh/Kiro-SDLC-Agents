"""AuditRepository — logs all memory operations for observability."""

import sqlite3
from typing import Any


class AuditRepository:
    """Audit trail for memory operations."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def log(self, operation: str, entry_id: int | None = None,
            session_id: str | None = None, details: str | None = None) -> None:
        """Log an operation to the audit trail."""
        self._conn.execute(
            """INSERT INTO memory_audit (operation, entry_id, session_id, details)
               VALUES (?, ?, ?, ?)""",
            (operation, entry_id, session_id, details),
        )
        self._conn.commit()

    def list_recent(self, limit: int = 20,
                    operation: str | None = None) -> list[dict[str, Any]]:
        """List recent audit entries."""
        if operation:
            cur = self._conn.execute(
                "SELECT * FROM memory_audit WHERE operation = ? ORDER BY created_at DESC LIMIT ?",
                (operation, limit),
            )
        else:
            cur = self._conn.execute(
                "SELECT * FROM memory_audit ORDER BY created_at DESC LIMIT ?",
                (limit,),
            )
        return [dict(r) for r in cur.fetchall()]
