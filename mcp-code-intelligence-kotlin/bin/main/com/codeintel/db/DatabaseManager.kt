/** SQLite lifecycle — connection management, WAL mode, schema. */
package com.codeintel.db

import com.codeintel.log
import java.nio.file.Path
import java.sql.Connection
import java.sql.DriverManager
import kotlin.io.path.createDirectories

class DatabaseManager(private val dbPath: String) {
    private var connection: Connection? = null

    /** Get the active connection. */
    val conn: Connection
        get() = connection ?: error("Database not initialized")

    /** Open database, enable WAL, apply schema. */
    fun initialize() {
        ensureDirectory()
        connection = DriverManager.getConnection("jdbc:sqlite:$dbPath")
        configure()
        applySchema()
        runMigrations()
        log("DB initialized at $dbPath")
    }

    /** Close connection gracefully. */
    fun close() {
        connection?.close()
        connection = null
    }

    private fun ensureDirectory() {
        Path.of(dbPath).parent.createDirectories()
    }

    private fun configure() {
        conn.createStatement().use { stmt ->
            stmt.execute("PRAGMA journal_mode = WAL")
            stmt.execute("PRAGMA synchronous = NORMAL")
            stmt.execute("PRAGMA cache_size = -64000")
            stmt.execute("PRAGMA foreign_keys = ON")
            stmt.execute("PRAGMA temp_store = MEMORY")
        }
    }

    private fun applySchema() {
        conn.createStatement().use { stmt ->
            val statements = splitSqlStatements(SCHEMA_V1)
            for (sql in statements) {
                if (sql.isNotBlank()) stmt.execute(sql)
            }
        }
    }

    /** Split SQL into individual statements, preserving trigger bodies. */
    private fun splitSqlStatements(sql: String): List<String> {
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
        if (current.isNotBlank()) results.add(current.toString().trim().removeSuffix(";"))
        return results.filter { it.isNotBlank() }
    }

    private fun runMigrations() {
        try {
            val existing = getExistingColumns("modules")
            var added = 0
            conn.createStatement().use { stmt ->
                for (col in PATTERN_COLUMNS) {
                    if (col !in existing) {
                        stmt.execute("ALTER TABLE modules ADD COLUMN $col TEXT DEFAULT NULL")
                        added++
                    }
                }
            }
            if (added > 0) log("Migration V2: added $added pattern columns")
        } catch (e: Exception) {
            log("Migration V2 error (graceful degradation): ${e.message}")
        }
    }

    private fun getExistingColumns(table: String): Set<String> {
        val columns = mutableSetOf<String>()
        conn.createStatement().use { stmt ->
            val rs = stmt.executeQuery("PRAGMA table_info($table)")
            while (rs.next()) {
                columns.add(rs.getString("name"))
            }
        }
        return columns
    }

    companion object {
        private val PATTERN_COLUMNS = listOf(
            "di_style", "error_handling", "naming_convention",
            "logging_framework", "testing_framework", "purpose"
        )
    }
}
