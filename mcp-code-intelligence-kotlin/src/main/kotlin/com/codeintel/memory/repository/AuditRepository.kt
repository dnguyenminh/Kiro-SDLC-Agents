/** Audit trail — logs all memory operations for observability. */
package com.codeintel.memory.repository

import com.codeintel.memory.db.MemoryDatabaseManager

data class AuditEntry(
    val id: Long = 0,
    val operation: String,
    val entryId: Long? = null,
    val sessionId: String? = null,
    val agentName: String? = null,
    val details: String? = null,
    val createdAt: String = ""
)

class AuditRepository(private val db: MemoryDatabaseManager) {

    /** Log an operation to the audit trail. */
    fun log(
        operation: String,
        entryId: Long? = null,
        sessionId: String? = null,
        agentName: String? = null,
        details: String? = null
    ) {
        val sql = """
            INSERT INTO memory_audit (operation, entry_id, session_id, agent_name, details)
            VALUES (?, ?, ?, ?, ?)
        """.trimIndent()
        db.conn.prepareStatement(sql).use { stmt ->
            stmt.setString(1, operation)
            if (entryId != null) stmt.setLong(2, entryId) else stmt.setNull(2, java.sql.Types.INTEGER)
            stmt.setString(3, sessionId)
            stmt.setString(4, agentName)
            stmt.setString(5, details)
            stmt.executeUpdate()
        }
    }

    /** List recent audit entries with filters. */
    fun listRecent(limit: Int = 50, operation: String? = null, afterId: Long? = null): List<AuditEntry> {
        val clauses = mutableListOf<String>()
        if (operation != null) clauses.add("operation = ?")
        if (afterId != null) clauses.add("id > ?")
        val sql = buildString {
            append("SELECT * FROM memory_audit")
            if (clauses.isNotEmpty()) append(" WHERE ${clauses.joinToString(" AND ")}")
            append(" ORDER BY id DESC LIMIT ?")
        }
        val results = mutableListOf<AuditEntry>()
        db.conn.prepareStatement(sql).use { stmt ->
            var idx = 1
            if (operation != null) stmt.setString(idx++, operation)
            if (afterId != null) stmt.setLong(idx++, afterId)
            stmt.setInt(idx, limit)
            val rs = stmt.executeQuery()
            while (rs.next()) results.add(mapRow(rs))
        }
        return results
    }

    /** List audit entries with exclude filter (for stream). */
    fun listFiltered(limit: Int, afterId: Long?, exclude: List<String>): List<AuditEntry> {
        val clauses = mutableListOf<String>()
        if (afterId != null) clauses.add("id > ?")
        if (exclude.isNotEmpty()) clauses.add("operation NOT IN (${exclude.joinToString(",") { "?" }})")
        val sql = buildString {
            append("SELECT * FROM memory_audit")
            if (clauses.isNotEmpty()) append(" WHERE ${clauses.joinToString(" AND ")}")
            append(" ORDER BY id DESC LIMIT ?")
        }
        val results = mutableListOf<AuditEntry>()
        db.conn.prepareStatement(sql).use { stmt ->
            var idx = 1
            if (afterId != null) stmt.setLong(idx++, afterId)
            for (op in exclude) stmt.setString(idx++, op)
            stmt.setInt(idx, limit)
            val rs = stmt.executeQuery()
            while (rs.next()) results.add(mapRow(rs))
        }
        return results
    }

    /** List audit entries for a specific session. */
    fun listBySession(sessionId: String, limit: Int = 200): List<AuditEntry> {
        val sql = "SELECT * FROM memory_audit WHERE session_id = ? ORDER BY created_at ASC LIMIT ?"
        val results = mutableListOf<AuditEntry>()
        db.conn.prepareStatement(sql).use { stmt ->
            stmt.setString(1, sessionId)
            stmt.setInt(2, limit)
            val rs = stmt.executeQuery()
            while (rs.next()) results.add(mapRow(rs))
        }
        return results
    }

    /** Count operations by type. */
    fun countByOperation(): Map<String, Int> {
        val sql = "SELECT operation, COUNT(*) as cnt FROM memory_audit GROUP BY operation"
        val counts = mutableMapOf<String, Int>()
        db.conn.createStatement().executeQuery(sql).use { rs ->
            while (rs.next()) {
                counts[rs.getString("operation")] = rs.getInt("cnt")
            }
        }
        return counts
    }

    private fun mapRow(rs: java.sql.ResultSet): AuditEntry = AuditEntry(
        id = rs.getLong("id"),
        operation = rs.getString("operation"),
        entryId = rs.getLong("entry_id").takeIf { !rs.wasNull() },
        sessionId = rs.getString("session_id"),
        agentName = rs.getString("agent_name"),
        details = rs.getString("details"),
        createdAt = rs.getString("created_at")
    )
}
