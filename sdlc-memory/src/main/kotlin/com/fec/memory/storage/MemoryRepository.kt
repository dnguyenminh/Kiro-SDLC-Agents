package com.fec.memory.storage

import mu.KotlinLogging
import java.sql.Connection

private val logger = KotlinLogging.logger {}

/**
 * Data access layer for memory CRUD operations.
 */
class MemoryRepository(private val conn: Connection) {

    fun insert(entry: MemoryEntry): Long {
        val sql = """
            INSERT INTO memories (tier, ticket_key, agent, category, title, content, metadata, importance)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """.trimIndent()
        conn.prepareStatement(sql, java.sql.Statement.RETURN_GENERATED_KEYS).use { stmt ->
            stmt.setString(1, entry.tier)
            stmt.setString(2, entry.ticketKey)
            stmt.setString(3, entry.agent)
            stmt.setString(4, entry.category)
            stmt.setString(5, entry.title)
            stmt.setString(6, entry.content)
            stmt.setString(7, entry.metadata)
            stmt.setDouble(8, entry.importance)
            stmt.executeUpdate()
            val keys = stmt.generatedKeys
            return if (keys.next()) keys.getLong(1) else -1
        }
    }

    fun findByTicket(ticketKey: String, limit: Int = 50): List<MemoryEntry> {
        val sql = "SELECT * FROM memories WHERE ticket_key = ? ORDER BY importance DESC, created_at DESC LIMIT ?"
        return executeQuery(sql, ticketKey, limit)
    }

    fun searchFts(query: String, limit: Int = 20): List<MemoryEntry> {
        val sql = """
            SELECT m.* FROM memories_fts
            JOIN memories m ON memories_fts.rowid = m.id
            WHERE memories_fts MATCH ?
            ORDER BY rank LIMIT ?
        """.trimIndent()
        return executeQuery(sql, query, limit)
    }

    fun getStats(): Map<String, Any> {
        val total = scalarInt("SELECT COUNT(*) FROM memories")
        val byTier = mapOf(
            "working" to scalarInt("SELECT COUNT(*) FROM memories WHERE tier='working'"),
            "episodic" to scalarInt("SELECT COUNT(*) FROM memories WHERE tier='episodic'"),
            "semantic" to scalarInt("SELECT COUNT(*) FROM memories WHERE tier='semantic'"),
            "procedural" to scalarInt("SELECT COUNT(*) FROM memories WHERE tier='procedural'")
        )
        return mapOf("total" to total, "byTier" to byTier)
    }

    private fun executeQuery(sql: String, vararg params: Any): List<MemoryEntry> {
        conn.prepareStatement(sql).use { stmt ->
            params.forEachIndexed { i, p ->
                when (p) {
                    is String -> stmt.setString(i + 1, p)
                    is Int -> stmt.setInt(i + 1, p)
                    else -> stmt.setObject(i + 1, p)
                }
            }
            val rs = stmt.executeQuery()
            val results = mutableListOf<MemoryEntry>()
            while (rs.next()) {
                results.add(MemoryEntry.fromResultSet(rs))
            }
            return results
        }
    }

    private fun scalarInt(sql: String): Int {
        conn.createStatement().use { stmt ->
            val rs = stmt.executeQuery(sql)
            return if (rs.next()) rs.getInt(1) else 0
        }
    }
}
