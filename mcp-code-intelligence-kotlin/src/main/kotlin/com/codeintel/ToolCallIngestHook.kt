/**
 * Fire-and-forget ingest of tool call I/O into KB for context retention.
 * Excludes memory tools to prevent infinite loops.
 */
package com.codeintel

import com.codeintel.memory.tools.MemoryToolDispatcher
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class ToolCallIngestHook(private val memoryDispatcher: MemoryToolDispatcher?) {

    /** Ingest tool call I/O if tool is not excluded. Fire-and-forget. */
    fun maybeIngest(toolName: String, arguments: JsonObject, output: String) {
        if (memoryDispatcher == null) return
        if (toolName in EXCLUDE_SET) return
        try {
            val content = "$toolName: $arguments\n---\n$output"
            memoryDispatcher.dispatch("mem_ingest", buildJsonObject {
                put("content", content)
                put("type", "CONTEXT")
                put("source", "tool-call-stream")
                put("tags", "tool-call,$toolName")
            })
        } catch (_: Exception) {
            // Fire-and-forget — never block tool response
        }
    }

    companion object {
        /** Memory tools excluded to prevent infinite ingest loops. */
        private val EXCLUDE_SET = setOf(
            "mem_ingest", "mem_search", "mem_ingest_file", "mem_crud",
            "mem_graph", "mem_consolidate", "mem_lifecycle", "mem_templates",
            "mem_attachments", "mem_discover", "mem_tags", "mem_citations",
            "mem_scoring", "mem_admin", "mem_get", "mem_delete",
            "mem_list", "mem_status", "mem_sessions", "mem_sync_code"
        )
    }
}
