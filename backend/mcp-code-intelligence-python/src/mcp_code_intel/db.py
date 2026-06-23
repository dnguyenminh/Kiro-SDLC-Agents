"""SQLite lifecycle — schema creation, WAL mode, migrations."""

import sqlite3
import sys
from pathlib import Path

PATTERN_COLUMNS = [
    'di_style',
    'error_handling',
    'naming_convention',
    'logging_framework',
    'testing_framework',
    'purpose',
]

SCHEMA_V1 = """
-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexed files with content hash for incremental updates
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  relative_path TEXT NOT NULL,
  language TEXT NOT NULL,
  module TEXT,
  content_hash TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  last_indexed TEXT NOT NULL DEFAULT (datetime('now')),
  line_count INTEGER NOT NULL DEFAULT 0
);

-- Extracted symbols (functions, classes, interfaces, etc.)
CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  signature TEXT,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  parent_symbol TEXT,
  visibility TEXT,
  doc_comment TEXT,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- FTS5 virtual table for full-text search on symbols
CREATE VIRTUAL TABLE IF NOT EXISTS symbols_fts USING fts5(
  name,
  signature,
  doc_comment,
  kind,
  content=symbols,
  content_rowid=id,
  tokenize='porter unicode61'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS symbols_ai AFTER INSERT ON symbols BEGIN
  INSERT INTO symbols_fts(rowid, name, signature, doc_comment, kind)
  VALUES (new.id, new.name, new.signature, new.doc_comment, new.kind);
END;

CREATE TRIGGER IF NOT EXISTS symbols_ad AFTER DELETE ON symbols BEGIN
  INSERT INTO symbols_fts(symbols_fts, rowid, name, signature, doc_comment, kind)
  VALUES ('delete', old.id, old.name, old.signature, old.doc_comment, old.kind);
END;

CREATE TRIGGER IF NOT EXISTS symbols_au AFTER UPDATE ON symbols BEGIN
  INSERT INTO symbols_fts(symbols_fts, rowid, name, signature, doc_comment, kind)
  VALUES ('delete', old.id, old.name, old.signature, old.doc_comment, old.kind);
  INSERT INTO symbols_fts(rowid, name, signature, doc_comment, kind)
  VALUES (new.id, new.name, new.signature, new.doc_comment, new.kind);
END;

-- Module groupings with pattern metadata
CREATE TABLE IF NOT EXISTS modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  root_path TEXT NOT NULL,
  language TEXT,
  description TEXT,
  file_count INTEGER NOT NULL DEFAULT 0,
  symbol_count INTEGER NOT NULL DEFAULT 0,
  di_style TEXT DEFAULT NULL,
  error_handling TEXT DEFAULT NULL,
  naming_convention TEXT DEFAULT NULL,
  logging_framework TEXT DEFAULT NULL,
  testing_framework TEXT DEFAULT NULL,
  purpose TEXT DEFAULT NULL
);

-- Optional embeddings for semantic search
CREATE TABLE IF NOT EXISTS embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol_id INTEGER,
  file_id INTEGER,
  vector BLOB NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_files_path ON files(relative_path);
CREATE INDEX IF NOT EXISTS idx_files_module ON files(module);
CREATE INDEX IF NOT EXISTS idx_files_language ON files(language);
CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);
CREATE INDEX IF NOT EXISTS idx_embeddings_symbol ON embeddings(symbol_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_file ON embeddings(file_id);
"""


class DatabaseManager:
    """Manages SQLite connection lifecycle and schema."""

    def __init__(self, db_path: str) -> None:
        self._db_path = db_path
        self._conn: sqlite3.Connection | None = None

    def initialize(self) -> None:
        """Open database, enable WAL, apply schema."""
        self._ensure_directory()
        self._conn = sqlite3.connect(self._db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._configure()
        self._apply_schema()
        self._run_migrations()
        _log(f"Initialized at {self._db_path}")

    @property
    def conn(self) -> sqlite3.Connection:
        """Get the active connection."""
        if not self._conn:
            raise RuntimeError("Database not initialized")
        return self._conn

    def close(self) -> None:
        """Close connection gracefully."""
        if self._conn:
            self._conn.close()
            self._conn = None
            _log("Connection closed")

    def _ensure_directory(self) -> None:
        Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)

    def _configure(self) -> None:
        c = self.conn
        c.execute("PRAGMA journal_mode = WAL")
        c.execute("PRAGMA synchronous = NORMAL")
        c.execute("PRAGMA cache_size = -64000")
        c.execute("PRAGMA foreign_keys = ON")
        c.execute("PRAGMA temp_store = MEMORY")

    def _apply_schema(self) -> None:
        self.conn.executescript(SCHEMA_V1)
        self.conn.commit()

    def _run_migrations(self) -> None:
        """Add pattern metadata columns if missing (idempotent)."""
        try:
            existing = self._get_existing_columns('modules')
            added = 0
            for col in PATTERN_COLUMNS:
                if col not in existing:
                    self.conn.execute(
                        f'ALTER TABLE modules ADD COLUMN {col} TEXT DEFAULT NULL'
                    )
                    added += 1
            if added:
                self.conn.commit()
                _log(f"Migration V2: added {added} pattern columns")
        except Exception as exc:
            _log(f"Migration V2 error (graceful degradation): {exc}")

    def _get_existing_columns(self, table: str) -> set[str]:
        """Get set of column names for a table."""
        cursor = self.conn.execute(f'PRAGMA table_info({table})')
        return {row[1] for row in cursor.fetchall()}


def _log(msg: str) -> None:
    print(f"[db] {msg}", file=sys.stderr, flush=True)
