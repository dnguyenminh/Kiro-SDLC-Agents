/** Memory database lifecycle — applies memory schema on top of existing DB. */
package com.codeintel.memory.db

import com.codeintel.db.DatabaseManager
import com.codeintel.log
import java.sql.Connection

class MemoryDatabaseManager(private val db: DatabaseManager) {
    val conn: Connection get() = db.conn

    /** Apply memory schema tables to existing database. */
    fun initialize() {
        applyMemorySchema()
        log("Memory schema initialized")
    }

    private fun applyMemorySchema() {
        conn.createStatement().use { stmt ->
            val statements = splitStatements(MEMORY_SCHEMA_V1)
            for (sql in statements) {
                if (sql.isNotBlank()) stmt.execute(sql)
            }
        }
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
