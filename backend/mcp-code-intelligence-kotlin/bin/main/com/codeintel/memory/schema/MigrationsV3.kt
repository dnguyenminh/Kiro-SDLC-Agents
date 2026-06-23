/** V3 migration runner — safely applies additive schema changes (KSA-110). */
package com.codeintel.memory.schema

import com.codeintel.log
import java.sql.Connection

/**
 * Run all V3 migrations (idempotent — safe to call multiple times).
 * Each ALTER is wrapped in try/catch (column may already exist).
 */
fun runV3Migrations(conn: Connection) {
    // F1: Core Memory
    runAlterStatements(conn, SchemaV3.CORE_MEMORY_ALTER)
    safeExec(conn, SchemaV3.CORE_MEMORY_INDEX)

    // F2: Conversation History
    safeExec(conn, SchemaV3.CONVERSATION_TABLE)

    // F3: Structured Map
    runAlterStatements(conn, SchemaV3.STRUCTURED_MAP_ALTER)
    safeExec(conn, SchemaV3.ENTITY_INDEX_TABLE)

    // F4: Anti-Pattern Protection
    runAlterStatements(conn, SchemaV3.QUALITY_ARCHIVE_ALTER)
    safeExec(conn, SchemaV3.QUALITY_ARCHIVE_INDEXES)
    safeExec(conn, SchemaV3.AGENT_SCOPE_TABLE)

    log("V3 migrations applied successfully")
}

/** Run ALTER statements one by one, ignoring "duplicate column" errors. */
private fun runAlterStatements(conn: Connection, stmts: List<String>) {
    conn.createStatement().use { stmt ->
        for (sql in stmts) {
            try {
                stmt.execute(sql)
            } catch (e: Exception) {
                if ("duplicate column" !in (e.message ?: "")) throw e
            }
        }
    }
}

/** Execute multi-statement SQL, ignoring "already exists" errors. */
private fun safeExec(conn: Connection, sql: String) {
    conn.createStatement().use { stmt ->
        for (line in sql.split(";").map { it.trim() }) {
            if (line.isBlank()) continue
            try {
                stmt.execute(line)
            } catch (e: Exception) {
                if ("already exists" !in (e.message ?: "")) throw e
            }
        }
    }
}
