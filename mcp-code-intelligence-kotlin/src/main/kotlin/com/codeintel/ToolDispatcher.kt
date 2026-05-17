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
        val engine = orchestrationEngine ?: return """{"error":"Unknown tool: $name"}"""
        if (!engine.isEnabled()) return """{"error":"Unknown tool: $name"}"""
        val chain = engine.getRegistry().getChain(name)
        if (chain != null) return executeChain(engine, chain, name, args)
        return try {
            runBlocking { engine.route(name, args) }
        } catch (e: Exception) {
            tryChildrenFallback(engine, name, args, e)
        }
    }

    /** Execute through fallback chain — try servers in config-declared priority order. */
    private fun executeChain(
        engine: OrchestrationEngine,
        chain: com.codeintel.orchestration.registry.ToolChain,
        name: String,
        args: JsonObject
    ): String {
        for (entry in chain.entries) {
            try {
                return runBlocking { engine.callChild(entry.serverName, name, args) }
            } catch (_: Exception) { /* try next in chain */ }
        }
        return """{"error":"Tool '$name' failed on all servers in chain"}"""
    }

    private fun tryChildrenFallback(
        engine: OrchestrationEngine, name: String, args: JsonObject, original: Exception
    ): String {
        for (server in engine.getChildServerNames()) {
            try {
                return runBlocking { engine.callChild(server, name, args) }
            } catch (_: Exception) { /* try next */ }
        }
        val msg = original.message?.replace("\"", "'") ?: "Internal error"
        return """{"error":"$msg"}"""
    }
}
