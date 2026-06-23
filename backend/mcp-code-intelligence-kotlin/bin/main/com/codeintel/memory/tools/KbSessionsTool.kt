/** kb_sessions tool — list recent memory sessions. */
package com.codeintel.memory.tools

import com.codeintel.memory.repository.SessionRepository
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive

class KbSessionsTool(private val sessionRepo: SessionRepository) {

    /** Execute kb_sessions — list recent sessions with stats. */
    fun execute(args: JsonObject): String {
        val limit = args["limit"]?.jsonPrimitive?.int ?: 20
        val sessions = sessionRepo.listRecent(limit)

        if (sessions.isEmpty()) return "No sessions found."

        val active = sessionRepo.activeCount()
        val lines = mutableListOf("Sessions (active: $active, showing ${sessions.size}):\n")
        for (s in sessions) {
            val duration = if (s.endedAt != null) "ended ${s.endedAt}" else "active"
            lines.add("[${s.sessionId}] ${s.status} | Agent: ${s.agentName ?: "unknown"}")
            lines.add("  Started: ${s.startedAt} | $duration | Observations: ${s.observationCount}")
            lines.add("")
        }
        return lines.joinToString("\n")
    }
}
