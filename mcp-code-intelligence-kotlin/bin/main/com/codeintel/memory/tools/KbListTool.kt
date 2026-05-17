/** kb_list tool — list knowledge entries with filters. */
package com.codeintel.memory.tools

import com.codeintel.memory.repository.KnowledgeRepository
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive

class KbListTool(private val repo: KnowledgeRepository) {

    /** Execute kb_list — list entries filtered by tier/type. */
    fun execute(args: JsonObject): String {
        val tier = args["tier"]?.jsonPrimitive?.content
        val type = args["type"]?.jsonPrimitive?.content
        val limit = args["limit"]?.jsonPrimitive?.int ?: 20

        val entries = when {
            tier != null -> repo.findByTier(tier, limit)
            type != null -> repo.findByType(type, limit)
            else -> repo.findByTier("WORKING", limit)
        }

        if (entries.isEmpty()) return "No entries found"
        val lines = mutableListOf("${entries.size} entries:\n")
        for (e in entries) {
            lines.add("#${e.id} [${e.type}] ${e.summary.take(80)}")
            lines.add("   Tier: ${e.tier} | Confidence: ${e.confidence} | Access: ${e.accessCount}")
        }
        return lines.joinToString("\n")
    }
}
