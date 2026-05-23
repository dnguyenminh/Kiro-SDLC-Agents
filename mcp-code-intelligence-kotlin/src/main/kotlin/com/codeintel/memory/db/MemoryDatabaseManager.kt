/** Memory database lifecycle — applies memory schema on top of existing DB. */
package com.codeintel.memory.db

import com.codeintel.db.DatabaseManager
import com.codeintel.log
import com.codeintel.memory.schema.runV3Migrations
import java.sql.Connection

class MemoryDatabaseManager(private val db: DatabaseManager) {
    val conn: Connection get() = db.conn

    /** Apply memory schema tables to existing database. */
    fun initialize() {
        applyMemorySchema()
        migrateAuditSchema()
        runV3Migrations(conn)
        log("Memory schema initialized (V3 migrations applied)")
    }

    private fun applyMemorySchema() {
        conn.createStatement().use { stmt ->
            val statements = splitStatements(MEMORY_SCHEMA_V1)
            for (sql in statements) {
                if (sql.isNotBlank()) stmt.execute(sql)
            }
        }
    }

    /** KSA-64: Add enriched audit columns (idempotent). */
    private fun migrateAuditSchema() {
        val existing = getColumnNames("memory_audit")
        val migrations = mapOf(
            "arguments" to "ALTER TABLE memory_audit ADD COLUMN arguments TEXT",
            "result_summary" to "ALTER TABLE memory_audit ADD COLUMN result_summary TEXT",
            "duration_ms" to "ALTER TABLE memory_audit ADD COLUMN duration_ms INTEGER",
            "task_id" to "ALTER TABLE memory_audit ADD COLUMN task_id TEXT",
            "tool_name" to "ALTER TABLE memory_audit ADD COLUMN tool_name TEXT"
        )
        conn.createStatement().use { stmt ->
            for ((col, sql) in migrations) {
                if (col !in existing) {
                    stmt.execute(sql)
                    log("Migration: added column $col to memory_audit")
                }
            }
            stmt.execute(
                "CREATE INDEX IF NOT EXISTS idx_audit_session_task ON memory_audit(session_id, task_id)"
            )
            stmt.execute(
                "CREATE INDEX IF NOT EXISTS idx_audit_tool_name ON memory_audit(tool_name) WHERE tool_name IS NOT NULL"
            )
        }
    }

    /** Get column names for a table via PRAGMA. */
    private fun getColumnNames(table: String): Set<String> {
        val cols = mutableSetOf<String>()
        conn.createStatement().executeQuery("PRAGMA table_info($table)").use { rs ->
            while (rs.next()) cols.add(rs.getString("name"))
        }
        return cols
    }

    /** Split SQL preserving trigger bodies. */
    private fun splitStatements(sql: String): List<String> {
        val results = mutableListOf<String>()
        val current = StringBuilder()
        var inTrigger = false

        for (line in sql.lines()) {
            val trimmed = line.trim().uppercase()
            if (trimmed.startsWith("CREATE TRIGGER")) inTrigger = true
            current.appendLine(line)
            if (inTrigger && trimmed == "END;") {
                inTrigger = false
                results.add(current.toString().trim().removeSuffix(";"))
                current.clear()
            } else if (!inTrigger && line.trimEnd().endsWith(";")) {
                results.add(current.toString().trim().removeSuffix(";"))
                current.clear()
            }
        }
        if (current.isNotBlank()) {
            results.add(current.toString().trim().removeSuffix(";"))
        }
        return results.filter { it.isNotBlank() }
    }
}
