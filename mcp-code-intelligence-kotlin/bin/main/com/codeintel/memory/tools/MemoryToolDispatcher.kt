/** Dispatches memory tool calls to appropriate handlers. */
package com.codeintel.memory.tools

import com.codeintel.memory.MemoryEngine
import com.codeintel.memory.consolidation.TierConsolidator
import com.codeintel.memory.embedding.EmbeddingService
import com.codeintel.memory.graph.KnowledgeGraph
import com.codeintel.memory.ingest.IngestFileExecutor
import com.codeintel.memory.ingest.IngestGraphLinker
import com.codeintel.memory.ingest.IngestPipeline
import com.codeintel.memory.repository.AuditRepository
import com.codeintel.memory.search.HybridSearch
import com.codeintel.query.QueryLayer
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive

class MemoryToolDispatcher(
    private val engine: MemoryEngine,
    private val embeddingService: EmbeddingService?,
    private val graph: KnowledgeGraph,
    private val workspace: String = "",
    private val queryLayer: QueryLayer? = null
) {
    private val pipeline = IngestPipeline(engine.knowledge, embeddingService)
    private val graphLinker = IngestGraphLinker(graph)
    private val fileExecutor = IngestFileExecutor(pipeline, workspace)
    private val hybridSearch = HybridSearch(engine.search, engine.vectors, embeddingService, graph)
    private val consolidator = TierConsolidator(engine.knowledge, engine.consolidation)
    private val audit: AuditRepository get() = engine.audit

    /** Dispatch a memory tool call. Returns null if not a memory tool. */
    fun dispatch(name: String, args: JsonObject): String? {
        return when (name) {
            "mem_search" -> executeSearch(args)
            "mem_ingest" -> executeIngest(args)
            "mem_ingest_file" -> executeIngestFile(args)
            "mem_sync_code" -> executeSyncCode(args)
            "mem_get" -> executeGet(args)
            "mem_delete" -> executeDelete(args)
            "mem_list" -> KbListTool(engine.knowledge).execute(args)
            "mem_graph" -> KbGraphTool(graph, engine.knowledge).execute(args)
            "mem_status" -> KbStatusTool(engine).execute(args)
            "mem_consolidate" -> executeConsolidate(args)
            "mem_audit" -> KbAuditTool(audit).execute(args)
            "mem_sessions" -> KbSessionsTool(engine.sessions).execute(args)
            else -> null
        }
    }

    private fun executeSearch(args: JsonObject): String {
        val result = KbSearchTool(hybridSearch).execute(args)
        audit.log("SEARCH", sessionId = engine.currentSessionId, details = args.toString().take(200))
        return result
    }

    private fun executeIngest(args: JsonObject): String {
        val result = KbIngestTool(pipeline).execute(args)
        engine.currentSessionId?.let { engine.sessions.incrementObservations(it) }
        audit.log("INGEST", sessionId = engine.currentSessionId, details = result.take(200))
        return result
    }

    private fun executeIngestFile(args: JsonObject): String {
        val filePath = args["file_path"]?.jsonPrimitive?.content
            ?: return "Error: file_path required"
        val type = args["type"]?.jsonPrimitive?.content ?: "CONTEXT"
        val format = args["format"]?.jsonPrimitive?.content ?: "markdown"

        val result = fileExecutor.ingest(filePath, type, format)
            ?: return "Error: file not found — $filePath (workspace=$workspace)"

        graphLinker.linkChunks(result.entryIds, result.source)
        engine.currentSessionId?.let { engine.sessions.incrementObservations(it) }
        val edges = graphLinker.edgeCount(result.entryIds)
        val msg = "Ingested: ${result.entriesCreated} entries, $edges edges from $filePath"
        audit.log("INGEST_FILE", sessionId = engine.currentSessionId, details = msg.take(200))
        return msg
    }

    private fun executeSyncCode(args: JsonObject): String {
        val ql = queryLayer ?: return "Error: code index not available"
        val tool = MemSyncCodeTool(engine, ql, graph)
        val result = tool.execute(args)
        audit.log("SYNC_CODE", sessionId = engine.currentSessionId, details = result.take(200))
        return result
    }

    private fun executeGet(args: JsonObject): String {
        val result = KbGetTool(engine.knowledge).execute(args)
        audit.log("ACCESS", sessionId = engine.currentSessionId, details = args.toString().take(200))
        return result
    }

    private fun executeDelete(args: JsonObject): String {
        val result = KbDeleteTool(engine.knowledge).execute(args)
        audit.log("DELETE", sessionId = engine.currentSessionId, details = result.take(200))
        return result
    }

    private fun executeConsolidate(args: JsonObject): String {
        val result = KbConsolidateTool(consolidator).execute(args)
        audit.log("CONSOLIDATE", sessionId = engine.currentSessionId, details = result.take(200))
        return result
    }
}
