"""V3 migration runner — safely applies additive schema changes (KSA-110)."""

import logging
import sqlite3

from .schema_v3 import (
    SCHEMA_V3_AGENT_SCOPE,
    SCHEMA_V3_CONVERSATION,
    SCHEMA_V3_CORE_MEMORY_ALTER,
    SCHEMA_V3_CORE_MEMORY_INDEX,
    SCHEMA_V3_ENTITY_INDEX,
    SCHEMA_V3_QUALITY_ARCHIVE_ALTER,
    SCHEMA_V3_QUALITY_ARCHIVE_INDEXES,
    SCHEMA_V3_STRUCTURED_MAP_ALTER,
)

logger = logging.getLogger(__name__)


def run_v3_migrations(conn: sqlite3.Connection) -> None:
    """Run all V3 migrations (idempotent — safe to call multiple times)."""
    # F1: Core Memory
    _run_alter_statements(conn, SCHEMA_V3_CORE_MEMORY_ALTER)
    _safe_exec(conn, SCHEMA_V3_CORE_MEMORY_INDEX)

    # F2: Conversation History
    _safe_exec(conn, SCHEMA_V3_CONVERSATION)

    # F3: Structured Map
    _run_alter_statements(conn, SCHEMA_V3_STRUCTURED_MAP_ALTER)
    _safe_exec(conn, SCHEMA_V3_ENTITY_INDEX)

    # F4: Anti-Pattern Protection
    _run_alter_statements(conn, SCHEMA_V3_QUALITY_ARCHIVE_ALTER)
    _safe_exec(conn, SCHEMA_V3_QUALITY_ARCHIVE_INDEXES)
    _safe_exec(conn, SCHEMA_V3_AGENT_SCOPE)

    conn.commit()
    logger.info("V3 migrations applied successfully")


def _run_alter_statements(conn: sqlite3.Connection, stmts: list[str]) -> None:
    """Run ALTER statements one by one, ignoring duplicate column errors."""
    cursor = conn.cursor()
    for sql in stmts:
        try:
            cursor.execute(sql)
        except sqlite3.OperationalError as e:
            if "duplicate column" not in str(e):
                raise


def _safe_exec(conn: sqlite3.Connection, sql: str) -> None:
    """Execute multi-statement SQL, ignoring already exists errors."""
    cursor = conn.cursor()
    for stmt in sql.strip().split(";"):
        stmt = stmt.strip()
        if not stmt:
            continue
        try:
            cursor.execute(stmt)
        except sqlite3.OperationalError as e:
            if "already exists" not in str(e):
                raise
