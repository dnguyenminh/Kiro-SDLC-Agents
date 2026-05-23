/** CRUD operations for knowledge entries. */
package com.codeintel.memory.repository

import com.codeintel.memory.db.MemoryDatabaseManager
import com.codeintel.memory.models.KnowledgeEntry
import java.sql.ResultSet

class KnowledgeRepository(private val db: MemoryDatabaseManager) {

    /** Insert a new knowledge entry, returns generated ID. */
    fun insert(entry: KnowledgeEntry): Long {
        val sql = """
            INSERT INTO knowledge_entries
            (content, summary, type, tier, source, source_ref, tags, confidence)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """.trimIndent()
        db.conn.prepareStatement(sql).use { stmt ->
            stmt.setString(1, entry.content)
            stmt.setString(2, entry.summary)
            stmt.setString(3, entry.type)
            stmt.setString(4, entry.tier)
            stmt.setString(5, entry.source)
            stmt.setString(6, entry.sourceRef)
            stmt.setString(7, entry.tags)
            stmt.setDouble(8, entry.confidence)
            stmt.executeUpdate()
        }
        return lastInsertId()
    }

    /** Find entry by ID. */
    fun findById(id: Long): KnowledgeEntry? {
        val sql = "SELECT * FROM knowledge_entries WHERE id = ?"
        db.conn.prepareStatement(sql).use { stmt ->
            stmt.setLong(1, id)
            val rs = stmt.executeQuery()
            return if (rs.next()) mapRow(rs) else null
        }
    }

    /** Find entries by tier. */
    fun findByTier(tier: String, limit: Int = 100): List<KnowledgeEntry> {
        val sql = "SELECT * FROM knowledge_entries WHERE tier = ? ORDER BY updated_at DESC LIMIT ?"
        return queryList(sql) { stmt ->
            stmt.setString(1, tier)
            stmt.setInt(2, limit)
        }
    }

    /** Find entries with flexible filters, sorting, and pagination. */
    fun findFiltered(
        tier: String?, type: String?, limit: Int, offset: Int, sort: String, afterId: Long?
    ): List<KnowledgeEntry> {
        val clauses = mutableListOf<String>()
        val params = mutableListOf<Any>()
        if (tier != null) { clauses.add("tier = ?"); params.add(tier) }
        if (type != null) { clauses.add("type = ?"); params.add(type) }
        if (afterId != null) { clauses.add("id > ?"); params.add(afterId) }
        val where = if (clauses.isEmpty()) "" else "WHERE ${clauses.joinToString(" AND ")}"
        val orderCol = when (sort) {
            "access_count" -> "access_count DESC"
            "confidence" -> "confidence DESC"
            else -> "created_at DESC"
        }
        val sql = "SELECT * FROM knowledge_entries $where ORDER BY $orderCol LIMIT ? OFFSET ?"
        params.add(limit); params.add(offset)
        return queryList(sql) { stmt ->
            params.forEachIndexed { i, p ->
                when (p) {
                    is String -> stmt.setString(i + 1, p)
                    is Int -> stmt.setInt(i + 1, p)
                    is Long -> stmt.setLong(i + 1, p)
                }
            }
        }
    }

    /** Find entries by type. */
    fun findByType(type: String, limit: Int = 100): List<KnowledgeEntry> {
        val sql = "SELECT * FROM knowledge_entries WHERE type = ? ORDER BY updated_at DESC LIMIT ?"
        return queryList(sql) { stmt ->
            stmt.setString(1, type)
            stmt.setInt(2, limit)
        }
    }

    /** Update tier for an entry. */
    fun updateTier(id: Long, newTier: String) {
        val sql = "UPDATE knowledge_entries SET tier = ?, updated_at = datetime('now') WHERE id = ?"
        db.conn.prepareStatement(sql).use { stmt ->
            stmt.setString(1, newTier)
            stmt.setLong(2, id)
            stmt.executeUpdate()
        }
    }

    /** Update quality_score for an entry (KSA-110 F4). */
    fun updateQualityScore(id: Long, score: Int) {
        val sql = "UPDATE knowledge_entries SET quality_score = ?, updated_at = datetime('now') WHERE id = ?"
        db.conn.prepareStatement(sql).use { stmt ->
            stmt.setInt(1, score)
            stmt.setLong(2, id)
            stmt.executeUpdate()
        }
    }

    /** Increment access count and update last_accessed_at. */
    fun recordAccess(id: Long) {
        val sql = """
            UPDATE knowledge_entries
            SET access_count = access_count + 1,
                last_accessed_at = datetime('now')
            WHERE id = ?
        """.trimIndent()
        db.conn.prepareStatement(sql).use { stmt ->
            stmt.setLong(1, id)
            stmt.executeUpdate()
        }
    }

    /** Delete entry by ID. */
    fun delete(id: Long) {
        db.conn.prepareStatement("DELETE FROM knowledge_entries WHERE id = ?").use { stmt ->
            stmt.setLong(1, id)
            stmt.executeUpdate()
        }
    }

    /** Count entries by tier. */
    fun countByTier(tier: String): Int {
        val sql = "SELECT COUNT(*) FROM knowledge_entries WHERE tier = ?"
        db.conn.prepareStatement(sql).use { stmt ->
            stmt.setString(1, tier)
            val rs = stmt.executeQuery()
            rs.next()
            return rs.getInt(1)
        }
    }

    private fun lastInsertId(): Long {
        db.conn.createStatement().use { stmt ->
            val rs = stmt.executeQuery("SELECT last_insert_rowid()")
            rs.next()
            return rs.getLong(1)
        }
    }

    private fun queryList(
        sql: String,
        bind: (java.sql.PreparedStatement) -> Unit
    ): List<KnowledgeEntry> {
        val results = mutableListOf<KnowledgeEntry>()
        db.conn.prepareStatement(sql).use { stmt ->
            bind(stmt)
            val rs = stmt.executeQuery()
            while (rs.next()) results.add(mapRow(rs))
        }
        return results
    }

    private fun mapRow(rs: ResultSet) = KnowledgeEntry(
        id = rs.getLong("id"),
        content = rs.getString("content"),
        summary = rs.getString("summary"),
        type = rs.getString("type"),
        tier = rs.getString("tier"),
        source = rs.getString("source"),
        sourceRef = rs.getString("source_ref"),
        tags = rs.getString("tags"),
        confidence = rs.getDouble("confidence"),
        accessCount = rs.getInt("access_count"),
        createdAt = rs.getString("created_at"),
        updatedAt = rs.getString("updated_at"),
        lastAccessedAt = rs.getString("last_accessed_at"),
        expiresAt = rs.getString("expires_at")
    )
}
