"""ConversationRepository — CRUD for structured conversation turns.

Stores conversations as structured records (role, content, turn, session).
Port of Node.js conversation-repo.ts (KSA-142 F2).
"""

import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime


@dataclass
class ConversationTurn:
    """A single conversation turn."""

    id: int
    session_id: str
    turn_number: int
    role: str
    content: str
    tool_calls: str | None
    metadata: str | None
    created_at: str


@dataclass
class SessionSummary:
    """Summary of a conversation session."""

    session_id: str
    turn_count: int
    first_turn_at: str
    last_turn_at: str
    roles: list[str]


class ConversationRepository:
    """CRUD for conversation_turns table."""

    def __init__(self, db: sqlite3.Connection) -> None:
        self.db = db

    def save_turn(
        self,
        session_id: str,
        role: str,
        content: str,
        tool_calls: list | None = None,
        metadata: dict | None = None,
    ) -> int:
        """Save a conversation turn. Returns turn ID."""
        if not session_id:
            session_id = f"session-{datetime.now().strftime('%Y-%m-%d-%H%M%S')}"
        turn_number = self._get_next_turn_number(session_id)
        cur = self.db.execute(
            "INSERT INTO conversation_turns "
            "(session_id, turn_number, role, content, tool_calls, metadata) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                session_id,
                turn_number,
                role,
                content,
                json.dumps(tool_calls) if tool_calls else None,
                json.dumps(metadata) if metadata else None,
            ),
        )
        self.db.commit()
        return cur.lastrowid

    def get_session(self, session_id: str, limit: int = 100) -> list[ConversationTurn]:
        """Get all turns for a session, ordered by turn number."""
        cur = self.db.execute(
            "SELECT id, session_id, turn_number, role, content, "
            "tool_calls, metadata, created_at "
            "FROM conversation_turns WHERE session_id = ? "
            "ORDER BY turn_number ASC LIMIT ?",
            (session_id, limit),
        )
        return [self._row_to_turn(row) for row in cur.fetchall()]

    def list_sessions(self, limit: int = 20) -> list[SessionSummary]:
        """List sessions with conversation data."""
        cur = self.db.execute(
            "SELECT session_id, COUNT(*) as turn_count, "
            "MIN(created_at) as first_turn_at, MAX(created_at) as last_turn_at "
            "FROM conversation_turns GROUP BY session_id "
            "ORDER BY last_turn_at DESC LIMIT ?",
            (limit,),
        )
        results = []
        for row in cur.fetchall():
            roles = self._get_session_roles(row[0])
            results.append(SessionSummary(
                session_id=row[0],
                turn_count=row[1],
                first_turn_at=row[2],
                last_turn_at=row[3],
                roles=roles,
            ))
        return results

    def search_turns(self, query: str, limit: int = 20) -> list[ConversationTurn]:
        """Search turns by content."""
        cur = self.db.execute(
            "SELECT id, session_id, turn_number, role, content, "
            "tool_calls, metadata, created_at "
            "FROM conversation_turns WHERE content LIKE ? "
            "ORDER BY created_at DESC LIMIT ?",
            (f"%{query}%", limit),
        )
        return [self._row_to_turn(row) for row in cur.fetchall()]

    def get_turns_by_time_range(
        self, after: str, before: str | None = None, limit: int = 50
    ) -> list[ConversationTurn]:
        """Get turns within a time range."""
        if before:
            cur = self.db.execute(
                "SELECT id, session_id, turn_number, role, content, "
                "tool_calls, metadata, created_at "
                "FROM conversation_turns WHERE created_at >= ? AND created_at <= ? "
                "ORDER BY created_at ASC LIMIT ?",
                (after, before, limit),
            )
        else:
            cur = self.db.execute(
                "SELECT id, session_id, turn_number, role, content, "
                "tool_calls, metadata, created_at "
                "FROM conversation_turns WHERE created_at >= ? "
                "ORDER BY created_at ASC LIMIT ?",
                (after, limit),
            )
        return [self._row_to_turn(row) for row in cur.fetchall()]

    def get_session_turn_count(self, session_id: str) -> int:
        """Get turn count for a session."""
        cur = self.db.execute(
            "SELECT COUNT(*) FROM conversation_turns WHERE session_id = ?",
            (session_id,),
        )
        return cur.fetchone()[0]

    def _get_next_turn_number(self, session_id: str) -> int:
        cur = self.db.execute(
            "SELECT MAX(turn_number) FROM conversation_turns WHERE session_id = ?",
            (session_id,),
        )
        mx = cur.fetchone()[0]
        return (mx or 0) + 1

    def _get_session_roles(self, session_id: str) -> list[str]:
        cur = self.db.execute(
            "SELECT DISTINCT role FROM conversation_turns WHERE session_id = ?",
            (session_id,),
        )
        return [row[0] for row in cur.fetchall()]

    def _row_to_turn(self, row: tuple) -> ConversationTurn:
        return ConversationTurn(
            id=row[0],
            session_id=row[1],
            turn_number=row[2],
            role=row[3],
            content=row[4],
            tool_calls=row[5],
            metadata=row[6],
            created_at=row[7],
        )
