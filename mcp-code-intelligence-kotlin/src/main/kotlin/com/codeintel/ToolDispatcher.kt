/**
 * Tool dispatcher — routes tool calls to native handlers, meta-tools, or orchestration layer.
 * Extracted from McpServer to keep file sizes under 200 lines.
 */
package com.codeintel

import com.codeintel.indexer.IndexingEngine
import com.codeintel.memory.MemoryEngine
import com.codeintel.memory.tools.MemoryToolDispatcher
import com.codeintel.orchestration.OrchestrationEngine
import com.codeintel.query.QueryLayer
import com.codeintel.tools.*
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonObject

class ToolDispatcher(
    private val config: Config,
    private val queryLayer: QueryLayer,
    private val indexer: IndexingEngine,
    private val memoryDispatcher: MemoryToolDispatcher?,
    private val orchestrationEngine: OrchestrationEngine?
) {
    /** Dispatch a tool call — tries memory, native, meta-tools, then orchestration. */
    fun dispatch(name: String, args: JsonObject): String {
        memoryDispatcher?.dispatch(name, args)?.let { return it }
        dispatchNative(name, args)?.let { return it }
        dispatchMeta(name, args)?.let { return it }
        return routeToOrchestration(name, args)
    }

    private fun dispatchNative(name: String, args: JsonObject): String? {
        return when (name) {
            "code_search" -> CodeSearchTool(queryLayer).execute(args)
            "code_symbols" -> CodeSymbolsTool(queryLayer).execute(args)
            "code_context" -> CodeContextTool(queryLayer, config.workspace).execute(args)
            "code_modules" -> CodeModulesTool(queryLayer).execute(args)
            "code_index_status" -> CodeIndexStatusTool(queryLayer, indexer).execute(args)
            "stream_write_file" -> StreamWriteFileTool(config.workspace).execute(args)
            "code_kb_export" -> CodeKbExportTool(queryLayer, config.workspace).execute(args)
            else -> null
        }
    }

    private fun dispatchMeta(name: String, args: JsonObject): String? {
        val engine = orchestrationEngine ?: return null
        if (!engine.isEnabled()) return null
        return engine.metaToolDispatcher.dispatch(name, args)
    }

    private fun routeToOrchestration(name: String, args: JsonObject): String {
        val engine = orchestrationEngine ?: return "Unknown tool: $name"
        if (!engine.isEnabled()) return "Unknown tool: $name"
        return try {
            runBlocking { engine.route(name, args) }
        } catch (e: Exception) {
            """{"error": "${e.message?.replace("\"", "'")}"}"""
        }
    }
}
