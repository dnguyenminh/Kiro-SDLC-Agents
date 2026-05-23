"""Tests for AgentScopeFilter — tag-based KB isolation per agent role."""

import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from mcp_code_intel.memory.agent_scope_filter import AgentScopeFilter


def _create_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.execute("""
        CREATE TABLE agent_scope_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          agent_role TEXT NOT NULL UNIQUE,
          tag_set TEXT NOT NULL DEFAULT '[]',
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    conn.executemany(
        "INSERT INTO agent_scope_config (agent_role, tag_set) VALUES (?, ?)",
        [
            ("QA", '["testing","qa","test-plan","bug"]'),
            ("DEV", '["code","api","architecture","design"]'),
            ("BA", '["requirement","business","process"]'),
        ],
    )
    conn.commit()
    return conn


def _make_result(tags: str, entry_id: int = 1) -> dict:
    return {"entry": {"id": entry_id, "content": "test", "tags": tags}, "score": 1.0}


def test_get_scope_known_role():
    conn = _create_db()
    f = AgentScopeFilter(conn)
    scope = f.get_scope("QA")
    assert scope is not None
    assert scope.role == "QA"
    assert "testing" in scope.tags
    assert "bug" in scope.tags


def test_get_scope_unknown_role():
    conn = _create_db()
    f = AgentScopeFilter(conn)
    assert f.get_scope("UNKNOWN") is None


def test_filter_keeps_matching_tags():
    conn = _create_db()
    f = AgentScopeFilter(conn)
    results = [
        _make_result("testing,qa", 1),
        _make_result("code,api", 2),
        _make_result("requirement", 3),
    ]
    filtered = f.filter(results, "QA")
    assert len(filtered) == 1
    assert filtered[0]["entry"]["id"] == 1


def test_filter_keeps_untagged_entries():
    conn = _create_db()
    f = AgentScopeFilter(conn)
    results = [
        _make_result("", 1),
        _make_result("code", 2),
    ]
    filtered = f.filter(results, "QA")
    assert len(filtered) == 1
    assert filtered[0]["entry"]["id"] == 1


def test_filter_returns_all_for_unknown_role():
    conn = _create_db()
    f = AgentScopeFilter(conn)
    results = [_make_result("testing", 1), _make_result("code", 2)]
    filtered = f.filter(results, "UNKNOWN")
    assert len(filtered) == 2


def test_update_scope_persists():
    conn = _create_db()
    f = AgentScopeFilter(conn)
    f.update_scope("QA", ["testing", "qa", "e2e", "performance"])
    scope = f.get_scope("QA")
    assert scope is not None
    assert len(scope.tags) == 4
    assert "e2e" in scope.tags


def test_case_insensitive_role():
    conn = _create_db()
    f = AgentScopeFilter(conn)
    assert f.get_scope("qa") is not None
    assert f.get_scope("Qa") is not None
    assert f.get_scope("QA") is not None


def test_filter_handles_mixed_case_tags():
    conn = _create_db()
    f = AgentScopeFilter(conn)
    results = [_make_result("Testing,QA", 1)]
    filtered = f.filter(results, "QA")
    assert len(filtered) == 1
