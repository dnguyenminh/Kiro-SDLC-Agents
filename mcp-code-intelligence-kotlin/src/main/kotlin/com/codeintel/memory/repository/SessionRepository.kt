/** Session tracking — each MCP connection = one session. */
package com.codeintel.memory.repository

import com.codeintel.memory.db.MemoryDatabaseManager
import java.util.UUID

data class MemorySession(
    val id: Long = 0,
    val sessionId: String,
    val agentName: String? = null,
    val startedAt: String = "",
    val endedAt: String? = null,
    val observationCount: Int = 0,
    val status: String = "active"
)

class SessionRepository(private val db: MemoryDatabaseManager) {

    /** Start a new session, returns session ID. */
    fun startSession(agentName: String? = null): String {
        val sessionId = UUID.randomUUID().toString().take(8)
        val sql = "INSERT INTO memory_sessions (session_id, agent_name) VALUES (?, ?)"
        db.conn.prepareStatement(sql).use { stmt ->
            stmt.setString(1, sessionId)
            stmt.setString(2, agentName)
            stmt.executeUpdate()
        }
        return sessionId
    }

    /** End a session. */
    fun endSession(sessionId: String) {
        val sql = "UPDATE memory_sessions SET status = 'ended', ended_at = datetime('now') WHERE session_id = ?"
        db.conn.prepareStatement(sql).use { it.setString(1, sessionId); it.executeUpdate() }
    }

    /** Increment observation count for a session. */
    fun incrementObservations(sessionId: String) {
        val sql = "UPDATE memory_sessions SET observation_count = observation_count + 1 WHERE session_id = ?"
        db.conn.prepareStatement(sql).use { it.setString(1, sessionId); it.executeUpdate() }
    }

    /** List recent sessions. */
    fun listRecent(limit: Int = 20): List<MemorySession> {
        val sql = "SELECT * FROM memory_sessions ORDER BY started_at DESC LIMIT ?"
        val results = mutableListOf<MemorySession>()
        db.conn.prepareStatement(sql).use { stmt ->
            stmt.setInt(1, limit)
            val rs = stmt.executeQuery()
            while (rs.next()) {
                results.add(MemorySession(
                    id = rs.getLong("id"),
                    sessionId = rs.getString("session_id"),
                    agentName = rs.getString("agent_name"),
                    startedAt = rs.getString("started_at"),
                    endedAt = rs.getString("ended_at"),
                    observationCount = rs.getInt("observation_count"),
                    status = rs.getString("status")
                ))
            }
        }
        return results
    }

    /** Get active session count. */
    fun activeCount(): Int {
        val rs = db.conn.createStatement().executeQuery(
            "SELECT COUNT(*) FROM memory_sessions WHERE status = 'active'"
        )
        rs.next()
        return rs.getInt(1)
    }
}
