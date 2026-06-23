/**
 * ConversationRepository — CRUD for structured conversation turns.
 * Port of Node.js conversation-repo.ts (KSA-142 F2).
 */
package com.codeintel.memory.conversation

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.sql.Connection
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

@Serializable
data class ConversationTurn(
    val id: Int,
    val sessionId: String,
    val turnNumber: Int,
    val role: String,
    val content: String,
    val toolCalls: String? = null,
    val metadata: String? = null,
    val createdAt: String = ""
)

@Serializable
data class SessionSummary(
    val sessionId: String,
    val turnCount: Int,
    val firstTurnAt: String,
    val lastTurnAt: String,
    val roles: List<String>
)

private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

class ConversationRepository(private val db: Connection) {

    /** Save a conversation turn. Returns turn ID. */
    fun saveTurn(
        sessionId: String?,
        role: String,
        content: String,
        toolCalls: List<Any>? = null,
        metadata: Map<String, String>? = null
    ): Long {
        val sid = sessionId?.ifBlank { null }
            ?: "session-${LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd-HHmmss"))}"
        val turnNumber = getNextTurnNumber(sid)
        val ps = db.prepareStatement(
            "INSERT INTO conversation_turns (session_id, turn_number, role, content, tool_calls, metadata) " +
                "VALUES (?, ?, ?, ?, ?, ?)"
        )
        ps.setString(1, sid)
        ps.setInt(2, turnNumber)
        ps.setString(3, role)
        ps.setString(4, content)
        ps.setString(5, toolCalls?.let { json.encodeToString(it.map { tc -> tc.toString() }) })
        ps.setString(6, metadata?.let { json.encodeToString(it) })
        ps.executeUpdate()
        val rs = db.createStatement().executeQuery("SELECT last_insert_rowid()")
        val id = if (rs.next()) rs.getLong(1) else 0L
        rs.close(); ps.close()
        return id
    }

    /** Get all turns for a session, ordered by turn number. */
    fun getSession(sessionId: String, limit: Int = 100): List<ConversationTurn> {
        val ps = db.prepareStatement(
            "SELECT id, session_id, turn_number, role, content, tool_calls, metadata, created_at " +
                "FROM conversation_turns WHERE session_id = ? ORDER BY turn_number ASC LIMIT ?"
        )
        ps.setString(1, sessionId); ps.setInt(2, limit)
        val rs = ps.executeQuery()
        val results = mutableListOf<ConversationTurn>()
        while (rs.next()) results.add(rowToTurn(rs))
        rs.close(); ps.close()
        return results
    }

    /** List sessions with conversation data. */
    fun listSessions(limit: Int = 20): List<SessionSummary> {
        val ps = db.prepareStatement(
            "SELECT session_id, COUNT(*) as turn_count, MIN(created_at) as first_turn_at, " +
                "MAX(created_at) as last_turn_at FROM conversation_turns " +
                "GROUP BY session_id ORDER BY last_turn_at DESC LIMIT ?"
        )
        ps.setInt(1, limit)
        val rs = ps.executeQuery()
        val results = mutableListOf<SessionSummary>()
        while (rs.next()) {
            val sid = rs.getString("session_id")
            results.add(SessionSummary(
                sessionId = sid,
                turnCount = rs.getInt("turn_count"),
                firstTurnAt = rs.getString("first_turn_at") ?: "",
                lastTurnAt = rs.getString("last_turn_at") ?: "",
                roles = getSessionRoles(sid)
            ))
        }
        rs.close(); ps.close()
        return results
    }

    /** Search turns by content. */
    fun searchTurns(query: String, limit: Int = 20): List<ConversationTurn> {
        val ps = db.prepareStatement(
            "SELECT id, session_id, turn_number, role, content, tool_calls, metadata, created_at " +
                "FROM conversation_turns WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?"
        )
        ps.setString(1, "%$query%"); ps.setInt(2, limit)
        val rs = ps.executeQuery()
        val results = mutableListOf<ConversationTurn>()
        while (rs.next()) results.add(rowToTurn(rs))
        rs.close(); ps.close()
        return results
    }

    /** Get turns by time range. */
    fun getTurnsByTimeRange(after: String, before: String? = null, limit: Int = 50): List<ConversationTurn> {
        val sql = if (before != null) {
            "SELECT id, session_id, turn_number, role, content, tool_calls, metadata, created_at " +
                "FROM conversation_turns WHERE created_at >= ? AND created_at <= ? ORDER BY created_at ASC LIMIT ?"
        } else {
            "SELECT id, session_id, turn_number, role, content, tool_calls, metadata, created_at " +
                "FROM conversation_turns WHERE created_at >= ? ORDER BY created_at ASC LIMIT ?"
        }
        val ps = db.prepareStatement(sql)
        ps.setString(1, after)
        if (before != null) { ps.setString(2, before); ps.setInt(3, limit) }
        else { ps.setInt(2, limit) }
        val rs = ps.executeQuery()
        val results = mutableListOf<ConversationTurn>()
        while (rs.next()) results.add(rowToTurn(rs))
        rs.close(); ps.close()
        return results
    }

    /** Get turn count for a session. */
    fun getSessionTurnCount(sessionId: String): Int {
        val ps = db.prepareStatement("SELECT COUNT(*) FROM conversation_turns WHERE session_id = ?")
        ps.setString(1, sessionId)
        val rs = ps.executeQuery()
        val count = if (rs.next()) rs.getInt(1) else 0
        rs.close(); ps.close()
        return count
    }

    private fun getNextTurnNumber(sessionId: String): Int {
        val ps = db.prepareStatement("SELECT MAX(turn_number) FROM conversation_turns WHERE session_id = ?")
        ps.setString(1, sessionId)
        val rs = ps.executeQuery()
        val mx = if (rs.next()) rs.getInt(1) else 0
        rs.close(); ps.close()
        return mx + 1
    }

    private fun getSessionRoles(sessionId: String): List<String> {
        val ps = db.prepareStatement("SELECT DISTINCT role FROM conversation_turns WHERE session_id = ?")
        ps.setString(1, sessionId)
        val rs = ps.executeQuery()
        val roles = mutableListOf<String>()
        while (rs.next()) roles.add(rs.getString(1))
        rs.close(); ps.close()
        return roles
    }

    private fun rowToTurn(rs: java.sql.ResultSet) = ConversationTurn(
        id = rs.getInt("id"),
        sessionId = rs.getString("session_id"),
        turnNumber = rs.getInt("turn_number"),
        role = rs.getString("role"),
        content = rs.getString("content") ?: "",
        toolCalls = rs.getString("tool_calls"),
        metadata = rs.getString("metadata"),
        createdAt = rs.getString("created_at") ?: ""
    )
}
