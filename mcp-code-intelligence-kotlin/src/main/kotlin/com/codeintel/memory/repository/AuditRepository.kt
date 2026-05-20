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
    // KSA-64: enriched fields
    val arguments: String? = null,
    val resultSummary: String? = null,
    val durationMs: Long? = null,
    val taskId: String? = null,
    val toolName: String? = null,
    val createdAt: String = ""
)

class AuditRepository(private val db: MemoryDatabaseManager) {

    /** Log an operation with enriched data. Backward compatible. */
    fun log(
        operation: String,
        entryId: Long? = null,
        sessionId: String? = null,
        agentName: String? = null,
        details: String? = null,
        arguments: String? = null,
        resultSummary: String? = null,
        durationMs: Long? = null,
        taskId: String? = null,
        toolName: String? = null
    ) {
        val sql = """
            INSERT INTO memory_audit
            (operation, entry_id, session_id, agent_name, details,
             arguments, result_summary, duration_ms, task_id, tool_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """.trimIndent()
        db.conn.prepareStatement(sql).use { stmt ->
            stmt.setString(1, operation)
            setNullableLong(stmt, 2, entryId)
            stmt.setString(3, sessionId)
            stmt.setString(4, agentName)
            stmt.setString(5, details)
            stmt.setString(6, arguments?.take(10240))
            stmt.setString(7, resultSummary?.take(2000))
            setNullableLong(stmt, 8, durationMs)
            stmt.setString(9, taskId)
            stmt.setString(10, toolName)
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
        if (exclude.isNotEmpty()) {
            clauses.add("operation NOT IN (${exclude.joinToString(",") { "?" }})")
        }
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
            while (rs.next()) counts[rs.getString("operation")] = rs.getInt("cnt")
        }
        return counts
    }

    private fun setNullableLong(stmt: java.sql.PreparedStatement, idx: Int, value: Long?) {
        if (value != null) stmt.setLong(idx, value)
        else stmt.setNull(idx, java.sql.Types.INTEGER)
    }

    private fun mapRow(rs: java.sql.ResultSet): AuditEntry = AuditEntry(
        id = rs.getLong("id"),
        operation = rs.getString("operation"),
        entryId = rs.getLong("entry_id").takeIf { !rs.wasNull() },
        sessionId = rs.getString("session_id"),
        agentName = rs.getString("agent_name"),
        details = rs.getString("details"),
        arguments = rs.getString("arguments"),
        resultSummary = rs.getString("result_summary"),
        durationMs = rs.getLong("duration_ms").takeIf { !rs.wasNull() },
        taskId = rs.getString("task_id"),
        toolName = rs.getString("tool_name"),
        createdAt = rs.getString("created_at")
    )
}
