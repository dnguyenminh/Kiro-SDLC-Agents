"use strict";
/**
 * Schema V3 — KB System Upgrade v0.6.0 migrations.
 * Feature 1: Core/Archival Memory (pinned entries + auto-recall)
 * Feature 2: Structured Conversation History
 * Feature 3: Structured Map (entity extraction + metadata enrichment)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCHEMA_V3_ENTITY_FTS = exports.SCHEMA_V3_CONVERSATION_INDEXES = exports.SCHEMA_V3_CONVERSATION_SUMMARIZED = exports.SCHEMA_V3_AGENT_SCOPE = exports.SCHEMA_V3_QUALITY_ARCHIVE_INDEXES = exports.SCHEMA_V3_QUALITY_ARCHIVE_ALTER = exports.SCHEMA_V3_STRUCTURED_MAP_TABLES = exports.SCHEMA_V3_STRUCTURED_MAP_ALTER = exports.SCHEMA_V3_CONVERSATION = exports.SCHEMA_V3_CORE_MEMORY_INDEX = exports.SCHEMA_V3_CORE_MEMORY = void 0;
/** Feature 1: Core Memory — pinned entries columns + index. */
exports.SCHEMA_V3_CORE_MEMORY = [
    'ALTER TABLE knowledge_entries ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE knowledge_entries ADD COLUMN pin_order INTEGER NOT NULL DEFAULT 0',
];
exports.SCHEMA_V3_CORE_MEMORY_INDEX = `
CREATE INDEX IF NOT EXISTS idx_ke_pinned ON knowledge_entries(pinned, pin_order);
`;
/** Feature 2: Structured Conversation History. */
exports.SCHEMA_V3_CONVERSATION = `
CREATE TABLE IF NOT EXISTS conversation_turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES memory_sessions(session_id)
);

CREATE INDEX IF NOT EXISTS idx_ct_session ON conversation_turns(session_id, turn_number);
CREATE INDEX IF NOT EXISTS idx_ct_role ON conversation_turns(role);
CREATE INDEX IF NOT EXISTS idx_ct_created ON conversation_turns(created_at);
`;
/** Feature 3: Structured Map — metadata enrichment column + entity index. */
exports.SCHEMA_V3_STRUCTURED_MAP_ALTER = [
    "ALTER TABLE knowledge_entries ADD COLUMN structured_map TEXT NOT NULL DEFAULT '{}'",
];
exports.SCHEMA_V3_STRUCTURED_MAP_TABLES = `
CREATE TABLE IF NOT EXISTS entity_index (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  entity_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ei_name ON entity_index(entity_name);
CREATE INDEX IF NOT EXISTS idx_ei_type ON entity_index(entity_type);
CREATE INDEX IF NOT EXISTS idx_ei_entry ON entity_index(entry_id);
`;
/** Feature 4: Anti-Pattern Protection — quality score, archived, agent scope. */
exports.SCHEMA_V3_QUALITY_ARCHIVE_ALTER = [
    'ALTER TABLE knowledge_entries ADD COLUMN quality_score INTEGER DEFAULT NULL',
    'ALTER TABLE knowledge_entries ADD COLUMN archived INTEGER NOT NULL DEFAULT 0',
];
exports.SCHEMA_V3_QUALITY_ARCHIVE_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_ke_archived ON knowledge_entries(archived);
CREATE INDEX IF NOT EXISTS idx_ke_quality ON knowledge_entries(quality_score);
CREATE INDEX IF NOT EXISTS idx_ke_tier_archived ON knowledge_entries(tier, archived, created_at);
`;
/** Feature 4: Agent Scope Config table. */
exports.SCHEMA_V3_AGENT_SCOPE = `
CREATE TABLE IF NOT EXISTS agent_scope_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_role TEXT NOT NULL UNIQUE,
  tag_set TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO agent_scope_config (agent_role, tag_set) VALUES
  ('QA', '["testing","qa","test-plan","test-case","bug"]'),
  ('DEV', '["code","api","architecture","implementation","design"]'),
  ('BA', '["requirement","business","stakeholder","process"]'),
  ('SA', '["architecture","design","infrastructure","security"]'),
  ('DEVOPS', '["deployment","infrastructure","ci-cd","monitoring"]');
`;
/** Feature 2 enhancement: summarized column on conversation_turns. */
exports.SCHEMA_V3_CONVERSATION_SUMMARIZED = [
    'ALTER TABLE conversation_turns ADD COLUMN summarized INTEGER NOT NULL DEFAULT 0',
];
exports.SCHEMA_V3_CONVERSATION_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_ct_summarized ON conversation_turns(summarized);
CREATE INDEX IF NOT EXISTS idx_ct_session_time ON conversation_turns(session_id, created_at);
`;
/** Feature 3 enhancement: Entity FTS5 for fast text search on entity names. */
exports.SCHEMA_V3_ENTITY_FTS = `
CREATE VIRTUAL TABLE IF NOT EXISTS entity_index_fts USING fts5(
  entity_name,
  content='entity_index',
  content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS entity_index_ai AFTER INSERT ON entity_index BEGIN
  INSERT INTO entity_index_fts(rowid, entity_name) VALUES (new.id, new.entity_name);
END;

CREATE TRIGGER IF NOT EXISTS entity_index_ad AFTER DELETE ON entity_index BEGIN
  INSERT INTO entity_index_fts(entity_index_fts, rowid, entity_name) VALUES ('delete', old.id, old.entity_name);
END;
`;
//# sourceMappingURL=schema-v3.js.map