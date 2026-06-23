/** Schema V3 — KB System Upgrade v0.6.0 migrations (KSA-110). */
package com.codeintel.memory.schema

/**
 * V3 migrations for 4 features:
 * F1: Core Memory (pinned entries + auto-recall)
 * F2: Structured Conversation History
 * F3: Structured Map (entity extraction)
 * F4: Anti-Pattern Protection (quality gate, agent scope, expiry, token budget)
 */
object SchemaV3 {

    /** F1: Core Memory — pinned entries columns. */
    val CORE_MEMORY_ALTER = listOf(
        "ALTER TABLE knowledge_entries ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE knowledge_entries ADD COLUMN pin_order INTEGER NOT NULL DEFAULT 0",
    )

    val CORE_MEMORY_INDEX = """
        CREATE INDEX IF NOT EXISTS idx_ke_pinned ON knowledge_entries(pinned, pin_order)
    """.trimIndent()

    /** F2: Structured Conversation History. */
    val CONVERSATION_TABLE = """
        CREATE TABLE IF NOT EXISTS conversation_turns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          turn_number INTEGER NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          tool_calls TEXT,
          metadata TEXT,
          summarized INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_ct_session ON conversation_turns(session_id, turn_number);
        CREATE INDEX IF NOT EXISTS idx_ct_role ON conversation_turns(role);
        CREATE INDEX IF NOT EXISTS idx_ct_created ON conversation_turns(created_at);
        CREATE INDEX IF NOT EXISTS idx_ct_summarized ON conversation_turns(summarized);
        CREATE INDEX IF NOT EXISTS idx_ct_session_time ON conversation_turns(session_id, created_at)
    """.trimIndent()

    /** F3: Structured Map — metadata enrichment column. */
    val STRUCTURED_MAP_ALTER = listOf(
        "ALTER TABLE knowledge_entries ADD COLUMN structured_map TEXT NOT NULL DEFAULT '{}'"
    )

    /** F3: Entity Index table. */
    val ENTITY_INDEX_TABLE = """
        CREATE TABLE IF NOT EXISTS entity_index (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_id INTEGER NOT NULL,
          entity_name TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          FOREIGN KEY (entry_id) REFERENCES knowledge_entries(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_ei_name ON entity_index(entity_name);
        CREATE INDEX IF NOT EXISTS idx_ei_type ON entity_index(entity_type);
        CREATE INDEX IF NOT EXISTS idx_ei_entry ON entity_index(entry_id)
    """.trimIndent()

    /** F4: Quality score + archived columns. */
    val QUALITY_ARCHIVE_ALTER = listOf(
        "ALTER TABLE knowledge_entries ADD COLUMN quality_score INTEGER DEFAULT NULL",
        "ALTER TABLE knowledge_entries ADD COLUMN archived INTEGER NOT NULL DEFAULT 0",
    )

    val QUALITY_ARCHIVE_INDEXES = """
        CREATE INDEX IF NOT EXISTS idx_ke_archived ON knowledge_entries(archived);
        CREATE INDEX IF NOT EXISTS idx_ke_quality ON knowledge_entries(quality_score);
        CREATE INDEX IF NOT EXISTS idx_ke_tier_archived ON knowledge_entries(tier, archived, created_at)
    """.trimIndent()

    /** F4: Agent Scope Config table with seed data. */
    val AGENT_SCOPE_TABLE = """
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
          ('DEVOPS', '["deployment","infrastructure","ci-cd","monitoring"]')
    """.trimIndent()
}
