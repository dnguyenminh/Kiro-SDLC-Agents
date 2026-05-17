/** kb_delete tool — delete a knowledge entry. */
package com.codeintel.memory.tools

import com.codeintel.memory.repository.KnowledgeRepository
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.long
import kotlinx.serialization.json.jsonPrimitive

class KbDeleteTool(private val repo: KnowledgeRepository) {

    /** Execute kb_delete — remove entry by ID. */
    fun execute(args: JsonObject): String {
        val id = args["id"]?.jsonPrimitive?.long ?: return "Error: id required"
        val existing = repo.findById(id) ?: return "Entry not found: $id"
        repo.delete(id)
        return "Deleted entry #$id: ${existing.summary.take(80)}"
    }
}
