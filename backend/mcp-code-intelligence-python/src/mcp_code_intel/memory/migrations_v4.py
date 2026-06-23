"""V4 migration runner — adds agent_name column to knowledge_entries."""

import logging
import sqlite3

from .schema_v4 import SCHEMA_V4_AGENT_NAME_ALTER, SCHEMA_V4_AGENT_NAME_INDEX

logger = logging.getLogger(__name__)


def run_v4_migrations(conn: sqlite3.Connection) -> None:
    """Run all V4 migrations (idempotent — safe to call multiple times)."""
    _run_alter_statements(conn, SCHEMA_V4_AGENT_NAME_ALTER)
    _safe_exec(conn, SCHEMA_V4_AGENT_NAME_INDEX)
    conn.commit()
    logger.info("V4 migrations applied successfully")


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
