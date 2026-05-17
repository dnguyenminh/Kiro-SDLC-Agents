/** kb_audit tool — list recent audit trail entries. */
package com.codeintel.memory.tools

import com.codeintel.memory.repository.AuditRepository
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive

class KbAuditTool(private val auditRepo: AuditRepository) {

    /** Execute kb_audit — list recent operations. */
    fun execute(args: JsonObject): String {
        val limit = args["limit"]?.jsonPrimitive?.int ?: 20
        val operation = args["operation"]?.jsonPrimitive?.content

        val entries = auditRepo.listRecent(limit, operation)
        if (entries.isEmpty()) return "No audit entries found."

        val lines = mutableListOf("Recent audit entries (${entries.size}):\n")
        for (e in entries) {
            lines.add("[${e.operation}] ${e.createdAt}")
            lines.add("  Entry: ${e.entryId ?: "n/a"} | Session: ${e.sessionId ?: "n/a"} | Agent: ${e.agentName ?: "n/a"}")
            if (e.details != null) lines.add("  Details: ${e.details.take(120)}")
            lines.add("")
        }
        return lines.joinToString("\n")
    }
}
