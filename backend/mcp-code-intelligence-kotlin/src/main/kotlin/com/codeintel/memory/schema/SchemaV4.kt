/** Schema V4 — Agent identification for knowledge entries. */
package com.codeintel.memory.schema

/**
 * V4 migration: adds agent_name column to track which agent created each entry.
 */
object SchemaV4 {

    /** Add agent_name column to knowledge_entries. */
    val AGENT_NAME_ALTER = listOf(
        "ALTER TABLE knowledge_entries ADD COLUMN agent_name TEXT DEFAULT NULL"
    )

    val AGENT_NAME_INDEX = """
        CREATE INDEX IF NOT EXISTS idx_ke_agent_name ON knowledge_entries(agent_name)
    """.trimIndent()
}
