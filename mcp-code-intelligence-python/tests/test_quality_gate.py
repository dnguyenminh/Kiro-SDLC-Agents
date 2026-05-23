"""Tests for QualityGate — content validation before KB ingest."""

import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from mcp_code_intel.memory.quality_gate import IngestMeta, QualityGate


def _create_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.execute("""
        CREATE TABLE knowledge_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content TEXT NOT NULL,
          archived INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    return conn


def test_rejects_short_content():
    conn = _create_db()
    gate = QualityGate(conn)
    result = gate.validate("short", IngestMeta())
    assert result.decision == "reject"
    assert result.score == 0
    assert "too short" in result.message


def test_accepts_well_formed_content():
    conn = _create_db()
    gate = QualityGate(conn)
    content = (
        "# Architecture Decision\n\n"
        "We decided to use SQLite for local storage because it requires no server.\n"
        "- Simple deployment\n- No network dependency\n"
        "Decision: Use SQLite for all local KB storage.\n"
        "This provides a robust solution for single-process applications.\n"
        "Additional context about the decision and its implications for the team.\n"
        "The implementation will use better-sqlite3 for synchronous access patterns."
    )
    meta = IngestMeta(tags="architecture,decision", type="DECISION", source="meeting")
    result = gate.validate(content, meta)
    assert result.decision == "accept"
    assert result.score >= 50


def test_warns_on_low_quality():
    conn = _create_db()
    gate = QualityGate(conn)
    content = "a" * 400  # length score = 400*40//500 = 32
    result = gate.validate(content, IngestMeta())
    assert result.decision == "warn"
    assert "Low quality" in result.message


def test_detects_duplicate():
    conn = _create_db()
    conn.execute(
        "INSERT INTO knowledge_entries (content) VALUES (?)",
        ("This is a detailed architecture decision about using SQLite for storage",),
    )
    conn.commit()
    gate = QualityGate(conn)
    result = gate.validate(
        "This is a detailed architecture decision about using SQLite for storage",
        IngestMeta(),
    )
    assert result.decision == "reject"
    assert result.duplicate_detected is True
    assert result.duplicate_entry_id is not None


def test_structure_adds_score():
    conn = _create_db()
    gate = QualityGate(conn)
    content = "# Heading\n\n- Item 1\n- Item 2\n\n```code```\nMore content here."
    meta = IngestMeta(tags="test")
    result = gate.validate(content, meta)
    # Has structure(10) + tags(20) + length
    assert result.score >= 30
    assert result.duplicate_detected is False


def test_actionable_content_adds_score():
    conn = _create_db()
    gate = QualityGate(conn)
    content = (
        "TODO: Implement quality gate. Decision: Use trigram detection. "
        "This is additional content to boost the length score above threshold. "
        "More text here to ensure we reach the 500 char mark for full points. "
        "The implementation should be straightforward and well-tested. "
        "We need to handle edge cases like empty content and very short strings."
    )
    meta = IngestMeta(tags="task", type="DECISION", source="notes")
    result = gate.validate(content, meta)
    assert result.decision == "accept"


def test_empty_content_rejected():
    conn = _create_db()
    gate = QualityGate(conn)
    result = gate.validate("", IngestMeta())
    assert result.decision == "reject"
    assert result.score == 0


def test_custom_thresholds():
    conn = _create_db()
    gate = QualityGate(conn, min_length=10, reject_threshold=50, warn_threshold=80)
    content = "Short but valid content here"
    result = gate.validate(content, IngestMeta())
    assert result.decision == "reject"  # score < 50


def test_no_duplicate_when_empty_db():
    conn = _create_db()
    gate = QualityGate(conn)
    content = "A completely new piece of knowledge that has never been stored before in the system."
    result = gate.validate(content, IngestMeta(tags="new"))
    assert result.duplicate_detected is False
