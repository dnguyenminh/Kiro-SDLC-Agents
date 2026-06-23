/** kb_get tool — retrieve a specific knowledge entry by ID. */
package com.codeintel.memory.tools

import com.codeintel.memory.repository.KnowledgeRepository
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.long
import kotlinx.serialization.json.jsonPrimitive

class KbGetTool(private val repo: KnowledgeRepository) {

    /** Execute kb_get — retrieve entry and record access. */
    fun execute(args: JsonObject): String {
        val id = args["id"]?.jsonPrimitive?.long ?: return "Error: id required"
        val entry = repo.findById(id) ?: return "Entry not found: $id"
        repo.recordAccess(id)
        return buildString {
            appendLine("Knowledge Entry #${entry.id}:")
            appendLine("  Summary: ${entry.summary}")
            appendLine("  Type: ${entry.type}")
            appendLine("  Tier: ${entry.tier}")
            appendLine("  Confidence: ${entry.confidence}")
            appendLine("  Access count: ${entry.accessCount + 1}")
            appendLine("  Source: ${entry.source ?: "n/a"}")
            appendLine("  Tags: ${entry.tags}")
            appendLine("  Created: ${entry.createdAt}")
            appendLine("  Content:")
            appendLine(entry.content)
        }
    }
}
