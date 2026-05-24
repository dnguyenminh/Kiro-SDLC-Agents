/**
 * Schema V3 — KB System Upgrade v0.6.0 migrations.
 * Feature 1: Core/Archival Memory (pinned entries + auto-recall)
 * Feature 2: Structured Conversation History
 * Feature 3: Structured Map (entity extraction + metadata enrichment)
 */
/** Feature 1: Core Memory — pinned entries columns + index. */
export declare const SCHEMA_V3_CORE_MEMORY: string[];
export declare const SCHEMA_V3_CORE_MEMORY_INDEX = "\nCREATE INDEX IF NOT EXISTS idx_ke_pinned ON knowledge_entries(pinned, pin_order);\n";
/** Feature 2: Structured Conversation History. */
export declare const SCHEMA_V3_CONVERSATION = "\nCREATE TABLE IF NOT EXISTS conversation_turns (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  session_id TEXT NOT NULL,\n  turn_number INTEGER NOT NULL,\n  role TEXT NOT NULL,\n  content TEXT NOT NULL,\n  tool_calls TEXT,\n  metadata TEXT,\n  created_at TEXT NOT NULL DEFAULT (datetime('now')),\n  FOREIGN KEY (session_id) REFERENCES memory_sessions(session_id)\n);\n\nCREATE INDEX IF NOT EXISTS idx_ct_session ON conversation_turns(session_id, turn_number);\nCREATE INDEX IF NOT EXISTS idx_ct_role ON conversation_turns(role);\nCREATE INDEX IF NOT EXISTS idx_ct_created ON conversation_turns(created_at);\n";
/** Feature 3: Structured Map — metadata enrichment column + entity index. */
export declare const SCHEMA_V3_STRUCTURED_MAP_ALTER: string[];
export declare const SCHEMA_V3_STRUCTURED_MAP_TABLES = "\nCREATE TABLE IF NOT EXISTS entity_index (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  entry_id INTEGER NOT NULL,\n  entity_name TEXT NOT NULL,\n  entity_type TEXT NOT NULL,\n  FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE\n);\n\nCREATE INDEX IF NOT EXISTS idx_ei_name ON entity_index(entity_name);\nCREATE INDEX IF NOT EXISTS idx_ei_type ON entity_index(entity_type);\nCREATE INDEX IF NOT EXISTS idx_ei_entry ON entity_index(entry_id);\n";
/** Feature 4: Anti-Pattern Protection — quality score, archived, agent scope. */
export declare const SCHEMA_V3_QUALITY_ARCHIVE_ALTER: string[];
export declare const SCHEMA_V3_QUALITY_ARCHIVE_INDEXES = "\nCREATE INDEX IF NOT EXISTS idx_ke_archived ON knowledge_entries(archived);\nCREATE INDEX IF NOT EXISTS idx_ke_quality ON knowledge_entries(quality_score);\nCREATE INDEX IF NOT EXISTS idx_ke_tier_archived ON knowledge_entries(tier, archived, created_at);\n";
/** Feature 4: Agent Scope Config table. */
export declare const SCHEMA_V3_AGENT_SCOPE = "\nCREATE TABLE IF NOT EXISTS agent_scope_config (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  agent_role TEXT NOT NULL UNIQUE,\n  tag_set TEXT NOT NULL DEFAULT '[]',\n  updated_at TEXT NOT NULL DEFAULT (datetime('now'))\n);\n\nINSERT OR IGNORE INTO agent_scope_config (agent_role, tag_set) VALUES\n  ('QA', '[\"testing\",\"qa\",\"test-plan\",\"test-case\",\"bug\"]'),\n  ('DEV', '[\"code\",\"api\",\"architecture\",\"implementation\",\"design\"]'),\n  ('BA', '[\"requirement\",\"business\",\"stakeholder\",\"process\"]'),\n  ('SA', '[\"architecture\",\"design\",\"infrastructure\",\"security\"]'),\n  ('DEVOPS', '[\"deployment\",\"infrastructure\",\"ci-cd\",\"monitoring\"]');\n";
/** Feature 2 enhancement: summarized column on conversation_turns. */
export declare const SCHEMA_V3_CONVERSATION_SUMMARIZED: string[];
export declare const SCHEMA_V3_CONVERSATION_INDEXES = "\nCREATE INDEX IF NOT EXISTS idx_ct_summarized ON conversation_turns(summarized);\nCREATE INDEX IF NOT EXISTS idx_ct_session_time ON conversation_turns(session_id, created_at);\n";
/** Feature 3 enhancement: Entity FTS5 for fast text search on entity names. */
export declare const SCHEMA_V3_ENTITY_FTS = "\nCREATE VIRTUAL TABLE IF NOT EXISTS entity_index_fts USING fts5(\n  entity_name,\n  content='entity_index',\n  content_rowid='id'\n);\n\nCREATE TRIGGER IF NOT EXISTS entity_index_ai AFTER INSERT ON entity_index BEGIN\n  INSERT INTO entity_index_fts(rowid, entity_name) VALUES (new.id, new.entity_name);\nEND;\n\nCREATE TRIGGER IF NOT EXISTS entity_index_ad AFTER DELETE ON entity_index BEGIN\n  INSERT INTO entity_index_fts(entity_index_fts, rowid, entity_name) VALUES ('delete', old.id, old.entity_name);\nEND;\n";
//# sourceMappingURL=schema-v3.d.ts.map