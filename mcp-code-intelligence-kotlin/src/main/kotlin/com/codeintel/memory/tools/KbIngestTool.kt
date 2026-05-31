/** kb_ingest tool — ingest knowledge into memory system. */
package com.codeintel.memory.tools

import com.codeintel.memory.ingest.IngestPipeline
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive

class KbIngestTool(private val pipeline: IngestPipeline) {

    /** Execute kb_ingest with given arguments. */
    fun execute(args: JsonObject): String {
        val content = args["content"]?.jsonPrimitive?.content ?: return "Error: content required"
        val type = args["type"]?.jsonPrimitive?.content ?: "CONTEXT"
        val source = args["source"]?.jsonPrimitive?.content
        val tags = args["tags"]?.let { element ->
            when {
                element is kotlinx.serialization.json.JsonArray -> element.map { it.jsonPrimitive.content }.joinToString(",")
                else -> element.jsonPrimitive.content
            }
        } ?: ""
        val summary = args["summary"]?.jsonPrimitive?.content ?: content.take(120)
        val agentName = args["agent_name"]?.jsonPrimitive?.content

        val id = pipeline.ingestEntry(content, summary, type, source, tags)
        if (agentName != null) {
            pipeline.updateAgentName(id, agentName)
        }
        return "Knowledge entry created: id=$id, type=$type, tier=WORKING"
    }
}
