/** CRUD operations for knowledge entry vectors (embeddings). */
package com.codeintel.memory.repository

import com.codeintel.memory.db.MemoryDatabaseManager
import java.sql.ResultSet

/** Stored vector with metadata. */
data class VectorRecord(
    val id: Long,
    val entryId: Long,
    val vector: ByteArray,
    val model: String,
    val dimensions: Int,
    val createdAt: String
)

class VectorRepository(private val db: MemoryDatabaseManager) {

    /** Store embedding vector for a knowledge entry. */
    fun upsert(entryId: Long, vector: ByteArray, model: String, dimensions: Int) {
        val sql = """
            INSERT INTO knowledge_vectors (entry_id, vector, model, dimensions)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(entry_id) DO UPDATE SET
              vector = excluded.vector,
              model = excluded.model,
              dimensions = excluded.dimensions,
              created_at = datetime('now')
        """.trimIndent()
        db.conn.prepareStatement(sql).use { stmt ->
            stmt.setLong(1, entryId)
            stmt.setBytes(2, vector)
            stmt.setString(3, model)
            stmt.setInt(4, dimensions)
            stmt.executeUpdate()
        }
    }

    /** Get vector for an entry. */
    fun findByEntryId(entryId: Long): VectorRecord? {
        val sql = "SELECT * FROM knowledge_vectors WHERE entry_id = ?"
        db.conn.prepareStatement(sql).use { stmt ->
            stmt.setLong(1, entryId)
            val rs = stmt.executeQuery()
            return if (rs.next()) mapRow(rs) else null
        }
    }

    /** Get all vectors (for brute-force similarity search). */
    fun findAll(): List<VectorRecord> {
        val results = mutableListOf<VectorRecord>()
        db.conn.createStatement().use { stmt ->
            val rs = stmt.executeQuery("SELECT * FROM knowledge_vectors")
            while (rs.next()) results.add(mapRow(rs))
        }
        return results
    }

    /** Delete vector for an entry. */
    fun delete(entryId: Long) {
        db.conn.prepareStatement("DELETE FROM knowledge_vectors WHERE entry_id = ?").use { stmt ->
            stmt.setLong(1, entryId)
            stmt.executeUpdate()
        }
    }

    /** Count total vectors stored. */
    fun count(): Int {
        db.conn.createStatement().use { stmt ->
            val rs = stmt.executeQuery("SELECT COUNT(*) FROM knowledge_vectors")
            rs.next()
            return rs.getInt(1)
        }
    }

    private fun mapRow(rs: ResultSet) = VectorRecord(
        id = rs.getLong("id"),
        entryId = rs.getLong("entry_id"),
        vector = rs.getBytes("vector"),
        model = rs.getString("model"),
        dimensions = rs.getInt("dimensions"),
        createdAt = rs.getString("created_at")
    )
}
