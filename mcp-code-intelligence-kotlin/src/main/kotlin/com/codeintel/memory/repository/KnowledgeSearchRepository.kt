/** FTS5 full-text search for knowledge entries. */
package com.codeintel.memory.repository

import com.codeintel.memory.db.MemoryDatabaseManager
import com.codeintel.memory.models.KnowledgeEntry
import com.codeintel.memory.models.KnowledgeSearchResult
import java.sql.ResultSet

class KnowledgeSearchRepository(private val db: MemoryDatabaseManager) {

    /** Full-text search across knowledge entries using FTS5. */
    fun search(query: String, limit: Int = 20): List<KnowledgeSearchResult> {
        val ftsQuery = sanitizeQuery(query)
        val sql = """
            SELECT ke.*, rank
            FROM knowledge_fts
            JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id
            WHERE knowledge_fts MATCH ?
            ORDER BY rank
            LIMIT ?
        """.trimIndent()
        val results = mutableListOf<KnowledgeSearchResult>()
        db.conn.prepareStatement(sql).use { stmt ->
            stmt.setString(1, ftsQuery)
            stmt.setInt(2, limit)
            val rs = stmt.executeQuery()
            while (rs.next()) {
                results.add(KnowledgeSearchResult(
                    entry = mapRow(rs),
                    score = -rs.getDouble("rank"),
                    matchType = "fts"
                ))
            }
        }
        return results
    }

    /** Search within a specific tier. */
    fun searchInTier(query: String, tier: String, limit: Int = 20): List<KnowledgeSearchResult> {
        val ftsQuery = sanitizeQuery(query)
        val sql = """
            SELECT ke.*, rank
            FROM knowledge_fts
            JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id
            WHERE knowledge_fts MATCH ? AND ke.tier = ?
            ORDER BY rank
            LIMIT ?
        """.trimIndent()
        val results = mutableListOf<KnowledgeSearchResult>()
        db.conn.prepareStatement(sql).use { stmt ->
            stmt.setString(1, ftsQuery)
            stmt.setString(2, tier)
            stmt.setInt(3, limit)
            val rs = stmt.executeQuery()
            while (rs.next()) {
                results.add(KnowledgeSearchResult(
                    entry = mapRow(rs),
                    score = -rs.getDouble("rank"),
                    matchType = "fts"
                ))
            }
        }
        return results
    }

    /** Search by tags (comma-separated). */
    fun searchByTags(tags: List<String>, limit: Int = 20): List<KnowledgeEntry> {
        val placeholders = tags.joinToString(" OR ") { "tags:\"$it\"" }
        return search(placeholders, limit).map { it.entry }
    }

    private fun sanitizeQuery(query: String): String {
        val cleaned = query.replace(Regex("[^\\w\\s*\":.]"), " ").trim()
        return cleaned.ifEmpty { "*" }
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
