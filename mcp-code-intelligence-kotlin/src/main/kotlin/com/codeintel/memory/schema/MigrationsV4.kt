/** V4 migration runner — adds agent_name column to knowledge_entries. */
package com.codeintel.memory.schema

import com.codeintel.log
import java.sql.Connection

/**
 * Run all V4 migrations (idempotent — safe to call multiple times).
 */
fun runV4Migrations(conn: Connection) {
    runV4AlterStatements(conn, SchemaV4.AGENT_NAME_ALTER)
    safeExecV4(conn, SchemaV4.AGENT_NAME_INDEX)
    log("V4 migrations applied successfully")
}

/** Run ALTER statements one by one, ignoring "duplicate column" errors. */
private fun runV4AlterStatements(conn: Connection, stmts: List<String>) {
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
private fun safeExecV4(conn: Connection, sql: String) {
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
