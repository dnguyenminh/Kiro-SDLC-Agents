"""MemoryEngine — facade for the SDLC Memory system."""

import sqlite3
import sys
from typing import Any

from .schema import MEMORY_SCHEMA
from .knowledge_repo import KnowledgeRepository
from .search_repo import KnowledgeSearchRepository
from .graph_repo import GraphRepository
from .knowledge_graph import KnowledgeGraph
from .session_repo import SessionRepository
from .audit_repo import AuditRepository
from .consolidation import ConsolidationRepository
from .vector_repo import VectorRepository


class MemoryEngine:
    """Single entry point for all memory operations."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn
        self._initialize_schema()

        self.knowledge = KnowledgeRepository(conn)
        self.search = KnowledgeSearchRepository(conn)
        self.graph_repo = GraphRepository(conn)
        self.graph = KnowledgeGraph(self.graph_repo)
        self.sessions = SessionRepository(conn)
        self.audit = AuditRepository(conn)
        self.consolidation = ConsolidationRepository(conn)
        self.vectors = VectorRepository(conn)

        self.graph.load_from_db()
        self._session_id: str | None = None

    def start_session(self, agent_name: str | None = None) -> str:
        """Start a new session."""
        sid = self.sessions.start_session(agent_name)
        self._session_id = sid
        self.audit.log("SESSION_START", session_id=sid)
        return sid

    def end_session(self) -> None:
        """End the current session."""
        if not self._session_id:
            return
        self.sessions.end_session(self._session_id)
        self.audit.log("SESSION_END", session_id=self._session_id)
        self._session_id = None

    @property
    def session_id(self) -> str | None:
        """Get current session ID."""
        return self._session_id

    def get_stats(self) -> dict[str, Any]:
        """Get overall memory statistics."""
        tier_stats = self.consolidation.get_tier_stats()
        total = sum(t["entry_count"] for t in tier_stats)
        return {
            "total_entries": total,
            "total_edges": self.graph_repo.count_edges(),
            "total_vectors": self.vectors.count(),
            "tier_breakdown": tier_stats,
        }

    def _initialize_schema(self) -> None:
        """Apply memory schema (idempotent)."""
        self._conn.executescript(MEMORY_SCHEMA)
        self._conn.commit()
        # Apply V3 migrations (KSA-110)
        from .migrations_v3 import run_v3_migrations
        run_v3_migrations(self._conn)
        # Apply V4 migrations (agent_name)
        from .migrations_v4 import run_v4_migrations
        run_v4_migrations(self._conn)
        _log("Schema initialized (V4 migrations applied)")


def _log(msg: str) -> None:
    print(f"[memory] {msg}", file=sys.stderr, flush=True)
