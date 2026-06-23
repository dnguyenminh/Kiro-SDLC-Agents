/** DDL for SDLC Memory Engine tables — FTS5 + vector-ready schema. */
package com.codeintel.memory.db

/** Memory schema V1 — knowledge entries, FTS, graph edges, consolidation. */
const val MEMORY_SCHEMA_V1 = """
CREATE TABLE IF NOT EXISTS knowledge_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  summary TEXT NOT NULL,
  type TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'WORKING',
  source TEXT,
  source_ref TEXT,
  tags TEXT NOT NULL DEFAULT '',
  confidence REAL NOT NULL DEFAULT 1.0,
  access_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_accessed_at TEXT,
  expires_at TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
  summary,
  content,
  tags,
  type,
  content=knowledge_entries,
  content_rowid=id,
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS knowledge_fts_ai AFTER INSERT ON knowledge_entries BEGIN
  INSERT INTO knowledge_fts(rowid, summary, content, tags, type)
  VALUES (new.id, new.summary, new.content, new.tags, new.type);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_fts_ad AFTER DELETE ON knowledge_entries BEGIN
  INSERT INTO knowledge_fts(knowledge_fts, rowid, summary, content, tags, type)
  VALUES ('delete', old.id, old.summary, old.content, old.tags, old.type);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_fts_au AFTER UPDATE ON knowledge_entries BEGIN
  INSERT INTO knowledge_fts(knowledge_fts, rowid, summary, content, tags, type)
  VALUES ('delete', old.id, old.summary, old.content, old.tags, old.type);
  INSERT INTO knowledge_fts(rowid, summary, content, tags, type)
  VALUES (new.id, new.summary, new.content, new.tags, new.type);
END;

CREATE TABLE IF NOT EXISTS knowledge_vectors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL UNIQUE,
  vector BLOB NOT NULL,
  model TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2',
  dimensions INTEGER NOT NULL DEFAULT 384,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  target_id INTEGER NOT NULL,
  relation TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS consolidation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  from_tier TEXT NOT NULL,
  to_tier TEXT NOT NULL,
  reason TEXT NOT NULL,
  consolidated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ke_tier ON knowledge_entries(tier);
CREATE INDEX IF NOT EXISTS idx_ke_type ON knowledge_entries(type);
CREATE INDEX IF NOT EXISTS idx_ke_source ON knowledge_entries(source);
CREATE INDEX IF NOT EXISTS idx_ke_confidence ON knowledge_entries(confidence);
CREATE INDEX IF NOT EXISTS idx_ke_access ON knowledge_entries(access_count);
CREATE INDEX IF NOT EXISTS idx_ke_created ON knowledge_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_ke_expires ON knowledge_entries(expires_at);
CREATE INDEX IF NOT EXISTS idx_kv_entry ON knowledge_vectors(entry_id);
CREATE INDEX IF NOT EXISTS idx_kge_source ON knowledge_graph_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_kge_target ON knowledge_graph_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_kge_relation ON knowledge_graph_edges(relation);
CREATE INDEX IF NOT EXISTS idx_cl_entry ON consolidation_log(entry_id);
CREATE INDEX IF NOT EXISTS idx_cl_tier ON consolidation_log(to_tier);

CREATE TABLE IF NOT EXISTS memory_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  agent_name TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  observation_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS memory_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT NOT NULL,
  entry_id INTEGER,
  session_id TEXT,
  agent_name TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ms_session ON memory_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_ms_status ON memory_sessions(status);
CREATE INDEX IF NOT EXISTS idx_ma_operation ON memory_audit(operation);
CREATE INDEX IF NOT EXISTS idx_ma_entry ON memory_audit(entry_id);
CREATE INDEX IF NOT EXISTS idx_ma_session ON memory_audit(session_id);
CREATE INDEX IF NOT EXISTS idx_ma_created ON memory_audit(created_at);

CREATE TABLE IF NOT EXISTS ingest_file_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL UNIQUE,
  checksum TEXT NOT NULL,
  mtime_ms INTEGER NOT NULL,
  file_size INTEGER NOT NULL,
  entry_count INTEGER NOT NULL DEFAULT 0,
  last_ingested_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ifc_path ON ingest_file_cache(file_path);
"""
