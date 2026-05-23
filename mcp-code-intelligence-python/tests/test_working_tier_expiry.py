"""Tests for WorkingTierExpiry — lazy auto-expiry of stale WORKING entries."""

import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from mcp_code_intel.memory.working_tier_expiry import WorkingTierExpiry


def _create_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.execute("""
        CREATE TABLE knowledge_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content TEXT NOT NULL,
          tier TEXT NOT NULL DEFAULT 'WORKING',
          archived INTEGER NOT NULL DEFAULT 0,
          pinned INTEGER NOT NULL DEFAULT 0,
          quality_score INTEGER DEFAULT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    return conn


def _insert_entry(
    conn: sqlite3.Connection,
    tier: str = "WORKING",
    archived: int = 0,
    pinned: int = 0,
    quality_score: int | None = None,
    hours_ago: int = 48,
) -> int:
    created_at = (datetime.now(timezone.utc) - timedelta(hours=hours_ago)).isoformat()
    conn.execute(
        "INSERT INTO knowledge_entries (content, tier, archived, pinned, quality_score, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        ("test content", tier, archived, pinned, quality_score, created_at),
    )
    conn.commit()
    return conn.execute("SELECT last_insert_rowid()").fetchone()[0]


def test_promotes_high_quality():
    conn = _create_db()
    _insert_entry(conn, quality_score=75, hours_ago=48)
    expiry = WorkingTierExpiry(conn, expiry_hours=24)
    actions = expiry.process_stale()
    assert len(actions) == 1
    assert actions[0].action == "promoted"
    assert actions[0].to_tier == "EPISODIC"


def test_archives_low_quality():
    conn = _create_db()
    _insert_entry(conn, quality_score=20, hours_ago=48)
    expiry = WorkingTierExpiry(conn, expiry_hours=24)
    actions = expiry.process_stale()
    assert len(actions) == 1
    assert actions[0].action == "archived"


def test_skips_pinned():
    conn = _create_db()
    _insert_entry(conn, pinned=1, quality_score=10, hours_ago=48)
    expiry = WorkingTierExpiry(conn, expiry_hours=24)
    actions = expiry.process_stale()
    assert len(actions) == 0


def test_skips_non_working_tier():
    conn = _create_db()
    _insert_entry(conn, tier="EPISODIC", quality_score=10, hours_ago=48)
    expiry = WorkingTierExpiry(conn, expiry_hours=24)
    actions = expiry.process_stale()
    assert len(actions) == 0


def test_skips_already_archived():
    conn = _create_db()
    _insert_entry(conn, archived=1, quality_score=10, hours_ago=48)
    expiry = WorkingTierExpiry(conn, expiry_hours=24)
    actions = expiry.process_stale()
    assert len(actions) == 0


def test_skips_recent_entries():
    conn = _create_db()
    _insert_entry(conn, quality_score=10, hours_ago=2)
    expiry = WorkingTierExpiry(conn, expiry_hours=24)
    actions = expiry.process_stale()
    assert len(actions) == 0


def test_processes_multiple():
    conn = _create_db()
    _insert_entry(conn, quality_score=80, hours_ago=48)
    _insert_entry(conn, quality_score=15, hours_ago=48)
    _insert_entry(conn, quality_score=65, hours_ago=48)
    expiry = WorkingTierExpiry(conn, expiry_hours=24)
    actions = expiry.process_stale()
    assert len(actions) == 3
    assert sum(1 for a in actions if a.action == "promoted") == 2
    assert sum(1 for a in actions if a.action == "archived") == 1


def test_null_quality_treated_as_zero():
    conn = _create_db()
    _insert_entry(conn, quality_score=None, hours_ago=48)
    expiry = WorkingTierExpiry(conn, expiry_hours=24)
    actions = expiry.process_stale()
    assert len(actions) == 1
    assert actions[0].action == "archived"


def test_empty_db_returns_empty():
    conn = _create_db()
    expiry = WorkingTierExpiry(conn, expiry_hours=24)
    actions = expiry.process_stale()
    assert len(actions) == 0
