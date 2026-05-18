/** Facade for the SDLC Memory Engine — single entry point for all memory operations. */
package com.codeintel.memory

import com.codeintel.db.DatabaseManager
import com.codeintel.log
import com.codeintel.memory.db.MemoryDatabaseManager
import com.codeintel.memory.repository.*

class MemoryEngine(db: DatabaseManager) {
    private val memoryDb = MemoryDatabaseManager(db)

    val connection: java.sql.Connection get() = memoryDb.conn
    val knowledge = KnowledgeRepository(memoryDb)
    val search = KnowledgeSearchRepository(memoryDb)
    val graph = GraphRepository(memoryDb)
    val vectors = VectorRepository(memoryDb)
    val consolidation = ConsolidationRepository(memoryDb)
    val sessions = SessionRepository(memoryDb)
    val audit = AuditRepository(memoryDb)

    /** Current active session ID (set after initialize). */
    var currentSessionId: String? = null
        private set

    /** Initialize memory schema and subsystems. */
    fun initialize() {
        memoryDb.initialize()
        log("Memory engine ready")
    }

    /** Start a new session and set it as current. */
    fun startSession(agentName: String? = null): String {
        val sid = sessions.startSession(agentName)
        currentSessionId = sid
        audit.log("SESSION_START", sessionId = sid, agentName = agentName)
        log("Session started: $sid")
        return sid
    }

    /** End the current session. */
    fun endSession() {
        val sid = currentSessionId ?: return
        sessions.endSession(sid)
        audit.log("SESSION_END", sessionId = sid)
        currentSessionId = null
        log("Session ended: $sid")
    }

    /** Get overall memory statistics. */
    fun getStats(): MemoryStats {
        val tierStats = consolidation.getTierStats()
        return MemoryStats(
            totalEntries = tierStats.sumOf { it.entryCount },
            totalEdges = graph.countEdges(),
            totalVectors = vectors.count(),
            tierBreakdown = tierStats.associate { it.tier to it.entryCount }
        )
    }
}

/** Summary statistics for the memory system. */
data class MemoryStats(
    val totalEntries: Int,
    val totalEdges: Int,
    val totalVectors: Int,
    val tierBreakdown: Map<String, Int>
)
