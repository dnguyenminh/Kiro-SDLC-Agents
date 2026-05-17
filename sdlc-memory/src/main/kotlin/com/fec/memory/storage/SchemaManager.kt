package com.fec.memory.storage

import mu.KotlinLogging
import java.sql.Connection

private val logger = KotlinLogging.logger {}

/**
 * Schema creation and migrations for SDLC Memory.
 */
object SchemaManager {

    fun applySchema(conn: Connection) {
        conn.createStatement().use { stmt ->
            stmt.executeUpdate(SCHEMA_V1)
        }
        conn.commit()
        logger.info { "Schema applied successfully" }
    }
}

private const val SCHEMA_V1 = """
-- Schema version
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Memory entries (all tiers)
CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tier TEXT NOT NULL CHECK(tier IN ('working','episodic','semantic','procedural')),
    ticket_key TEXT,
    agent TEXT,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    importance REAL NOT NULL DEFAULT 0.5,
    access_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT,
    consolidated_from INTEGER REFERENCES memories(id)
);

-- FTS5 for full-text search on memories
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
    title, content, category, agent, ticket_key,
    content=memories, content_rowid=id,
    tokenize='porter unicode61'
);

-- FTS sync triggers
CREATE TRIGGER IF NOT EXISTS mem_ai AFTER INSERT ON memories BEGIN
    INSERT INTO memories_fts(rowid, title, content, category, agent, ticket_key)
    VALUES (new.id, new.title, new.content, new.category, new.agent, new.ticket_key);
END;

CREATE TRIGGER IF NOT EXISTS mem_ad AFTER DELETE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, title, content, category, agent, ticket_key)
    VALUES ('delete', old.id, old.title, old.content, old.category, old.agent, old.ticket_key);
END;

CREATE TRIGGER IF NOT EXISTS mem_au AFTER UPDATE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, title, content, category, agent, ticket_key)
    VALUES ('delete', old.id, old.title, old.content, old.category, old.agent, old.ticket_key);
    INSERT INTO memories_fts(rowid, title, content, category, agent, ticket_key)
    VALUES (new.id, new.title, new.content, new.category, new.agent, new.ticket_key);
END;

-- Vector embeddings
CREATE TABLE IF NOT EXISTS embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memory_id INTEGER NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    vector BLOB NOT NULL,
    model TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Knowledge graph edges
CREATE TABLE IF NOT EXISTS graph_edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    target_id INTEGER NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    relation TEXT NOT NULL,
    weight REAL NOT NULL DEFAULT 1.0,
    metadata TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Decisions
CREATE TABLE IF NOT EXISTS decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memory_id INTEGER NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    decision_type TEXT NOT NULL,
    context TEXT NOT NULL,
    chosen_option TEXT NOT NULL,
    alternatives TEXT DEFAULT '[]',
    rationale TEXT,
    outcome TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Error patterns
CREATE TABLE IF NOT EXISTS error_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memory_id INTEGER NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    error_type TEXT NOT NULL,
    pattern TEXT NOT NULL,
    resolution TEXT,
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    last_seen TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Agent handoffs
CREATE TABLE IF NOT EXISTS handoffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_key TEXT NOT NULL,
    from_agent TEXT NOT NULL,
    to_agent TEXT NOT NULL,
    phase TEXT NOT NULL,
    context_summary TEXT NOT NULL,
    key_decisions TEXT DEFAULT '[]',
    open_issues TEXT DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_mem_tier ON memories(tier);
CREATE INDEX IF NOT EXISTS idx_mem_ticket ON memories(ticket_key);
CREATE INDEX IF NOT EXISTS idx_mem_agent ON memories(agent);
CREATE INDEX IF NOT EXISTS idx_mem_category ON memories(category);
CREATE INDEX IF NOT EXISTS idx_mem_importance ON memories(importance DESC);
CREATE INDEX IF NOT EXISTS idx_emb_memory ON embeddings(memory_id);
CREATE INDEX IF NOT EXISTS idx_graph_source ON graph_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_graph_target ON graph_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_graph_relation ON graph_edges(relation);
CREATE INDEX IF NOT EXISTS idx_decisions_type ON decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_errors_type ON error_patterns(error_type);
CREATE INDEX IF NOT EXISTS idx_handoffs_ticket ON handoffs(ticket_key);

INSERT OR IGNORE INTO schema_version (version) VALUES (1);
"""
