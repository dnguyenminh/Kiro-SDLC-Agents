"""SQLite-backed vector index for git commit embeddings."""

from __future__ import annotations

import json
import math
import sqlite3
import struct
import sys
from dataclasses import dataclass
from typing import Any

from .git_log_parser import Commit


GIT_SCHEMA = """
CREATE TABLE IF NOT EXISTS git_commits (
    hash TEXT PRIMARY KEY,
    author TEXT NOT NULL,
    date TEXT NOT NULL,
    message TEXT NOT NULL,
    files_changed TEXT NOT NULL,
    insertions INTEGER DEFAULT 0,
    deletions INTEGER DEFAULT 0,
    embedding BLOB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_git_date ON git_commits(date);
CREATE INDEX IF NOT EXISTS idx_git_author ON git_commits(author);

CREATE TABLE IF NOT EXISTS git_index_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


@dataclass
class VectorSearchResult:
    """Result from vector similarity search."""
    hash: str
    author: str
    date: str
    message: str
    files_changed: list[str]
    insertions: int
    deletions: int
    similarity: float


class GitVectorIndex:
    """Store and search git commit vectors in SQLite."""

    def __init__(self, db_conn: sqlite3.Connection) -> None:
        self._conn = db_conn
        self._ensure_schema()

    def _ensure_schema(self) -> None:
        """Create git tables if they don't exist."""
        self._conn.executescript(GIT_SCHEMA)
        self._conn.commit()

    def store(self, commit: Commit, embedding: bytes) -> None:
        """Store a commit with its embedding vector."""
        self._conn.execute("""
            INSERT OR REPLACE INTO git_commits
            (hash, author, date, message, files_changed, insertions, deletions, embedding)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            commit.hash,
            commit.author,
            commit.date,
            commit.message,
            json.dumps(commit.files_changed),
            commit.insertions,
            commit.deletions,
            embedding,
        ))

    def store_batch(self, items: list[tuple[Commit, bytes]]) -> int:
        """Store multiple commits. Returns count stored."""
        count = 0
        for commit, embedding in items:
            self.store(commit, embedding)
            count += 1
        self._conn.commit()
        return count

    def search(self, query_embedding: bytes, limit: int = 10) -> list[VectorSearchResult]:
        """Search for similar commits using cosine similarity."""
        query_vec = _bytes_to_floats(query_embedding)

        rows = self._conn.execute("""
            SELECT hash, author, date, message, files_changed,
                   insertions, deletions, embedding
            FROM git_commits
        """).fetchall()

        scored: list[tuple[float, Any]] = []
        for row in rows:
            stored_vec = _bytes_to_floats(row[7])
            sim = _cosine_similarity(query_vec, stored_vec)
            scored.append((sim, row))

        scored.sort(key=lambda x: x[0], reverse=True)

        results: list[VectorSearchResult] = []
        for sim, row in scored[:limit]:
            results.append(VectorSearchResult(
                hash=row[0],
                author=row[1],
                date=row[2],
                message=row[3],
                files_changed=json.loads(row[4]),
                insertions=row[5],
                deletions=row[6],
                similarity=sim,
            ))

        return results

    def get_last_indexed_hash(self) -> str | None:
        """Get the last indexed commit hash."""
        row = self._conn.execute("""
            SELECT value FROM git_index_meta WHERE key = 'last_indexed_hash'
        """).fetchone()
        return row[0] if row else None

    def set_last_indexed_hash(self, hash_val: str) -> None:
        """Update the last indexed commit hash."""
        self._conn.execute("""
            INSERT OR REPLACE INTO git_index_meta (key, value)
            VALUES ('last_indexed_hash', ?)
        """, (hash_val,))
        self._conn.commit()

    def get_total_commits(self) -> int:
        """Get total number of indexed commits."""
        row = self._conn.execute("SELECT COUNT(*) FROM git_commits").fetchone()
        return row[0] if row else 0

    def get_meta(self, key: str) -> str | None:
        """Get metadata value."""
        row = self._conn.execute(
            "SELECT value FROM git_index_meta WHERE key = ?", (key,)
        ).fetchone()
        return row[0] if row else None

    def set_meta(self, key: str, value: str) -> None:
        """Set metadata value."""
        self._conn.execute(
            "INSERT OR REPLACE INTO git_index_meta (key, value) VALUES (?, ?)",
            (key, value),
        )
        self._conn.commit()


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if len(a) != len(b) or not a:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    denom = norm_a * norm_b
    return dot / denom if denom > 0 else 0.0


def _bytes_to_floats(data: bytes) -> list[float]:
    """Convert little-endian bytes to float list."""
    count = len(data) // 4
    return list(struct.unpack(f"<{count}f", data))


def _log(msg: str) -> None:
    print(f"[git-index] {msg}", file=sys.stderr, flush=True)
