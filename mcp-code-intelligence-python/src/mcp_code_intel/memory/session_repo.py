"""SessionRepository — tracks MCP sessions (one per connection)."""

import sqlite3
import uuid
from typing import Any


class SessionRepository:
    """Session tracking for memory engine."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def start_session(self, agent_name: str | None = None) -> str:
        """Start a new session, returns 8-char session ID."""
        session_id = uuid.uuid4().hex[:8]
        self._conn.execute(
            "INSERT INTO memory_sessions (session_id, agent_name) VALUES (?, ?)",
            (session_id, agent_name),
        )
        self._conn.commit()
        return session_id

    def end_session(self, session_id: str) -> None:
        """End a session."""
        self._conn.execute(
            "UPDATE memory_sessions SET status = 'ended', ended_at = datetime('now') WHERE session_id = ?",
            (session_id,),
        )
        self._conn.commit()

    def increment_observations(self, session_id: str) -> None:
        """Increment observation count."""
        self._conn.execute(
            "UPDATE memory_sessions SET observation_count = observation_count + 1 WHERE session_id = ?",
            (session_id,),
        )
        self._conn.commit()

    def list_recent(self, limit: int = 20) -> list[dict[str, Any]]:
        """List recent sessions."""
        cur = self._conn.execute(
            "SELECT * FROM memory_sessions ORDER BY started_at DESC LIMIT ?",
            (limit,),
        )
        return [dict(r) for r in cur.fetchall()]

    def active_count(self) -> int:
        """Get active session count."""
        cur = self._conn.execute(
            "SELECT COUNT(*) FROM memory_sessions WHERE status = 'active'"
        )
        return cur.fetchone()[0]
