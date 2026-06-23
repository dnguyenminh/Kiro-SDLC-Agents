package com.fec.memory.storage

import com.fec.memory.config.AppConfig
import mu.KotlinLogging
import java.nio.file.Files
import java.sql.Connection
import java.sql.DriverManager

private val logger = KotlinLogging.logger {}

/**
 * SQLite database lifecycle manager.
 * Handles connection, WAL mode, schema creation.
 */
class DatabaseManager(private val config: AppConfig) {
    private var connection: Connection? = null

    fun initialize(): Connection {
        Files.createDirectories(config.dbPath.parent)
        val conn = DriverManager.getConnection("jdbc:sqlite:${config.dbPath}")
        configurePragmas(conn)
        SchemaManager.applySchema(conn)
        connection = conn
        logger.info { "Database initialized at ${config.dbPath}" }
        return conn
    }

    fun getConnection(): Connection {
        return connection ?: throw IllegalStateException("DB not initialized")
    }

    fun close() {
        connection?.close()
        connection = null
        logger.info { "Database connection closed" }
    }

    private fun configurePragmas(conn: Connection) {
        conn.createStatement().use { stmt ->
            stmt.execute("PRAGMA journal_mode = WAL")
            stmt.execute("PRAGMA synchronous = NORMAL")
            stmt.execute("PRAGMA cache_size = -64000")
            stmt.execute("PRAGMA foreign_keys = ON")
            stmt.execute("PRAGMA temp_store = MEMORY")
        }
    }
}
