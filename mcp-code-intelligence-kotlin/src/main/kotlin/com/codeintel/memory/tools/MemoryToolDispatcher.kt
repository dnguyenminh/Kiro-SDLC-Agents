/** Dispatches memory tool calls to appropriate handlers. */
package com.codeintel.memory.tools

import com.codeintel.memory.MemoryEngine
import com.codeintel.memory.consolidation.TierConsolidator
import com.codeintel.memory.embedding.EmbeddingService
import com.codeintel.memory.graph.KnowledgeGraph
import com.codeintel.memory.ingest.IngestDeduplicator
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
    private val deduplicator = IngestDeduplicator(engine.connection)
    private val fileExecutor = IngestFileExecutor(pipeline, workspace, deduplicator)
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
        val query = args["query"]?.jsonPrimitive?.content ?: ""
        val result = KbSearchTool(hybridSearch).execute(args)
        audit.log("SEARCH", sessionId = engine.currentSessionId, details = args.toString().take(200))
        logSearchForAnalytics(query, result)
        recordSearchAccessAndCitations(result)
        return result
    }

    /** Increment access_count and auto-cite entries returned in search results. */
    private fun recordSearchAccessAndCitations(result: String) {
        try {
            val ids = Regex("""ID: (\d+)""").findAll(result).map { it.groupValues[1].toLong() }.toList()
            if (ids.isEmpty()) return
            val conn = engine.connection
            val accessStmt = conn.prepareStatement(
                "UPDATE knowledge_entries SET access_count = access_count + 1, last_accessed_at = datetime('now') WHERE id = ?"
            )
            val citeStmt = conn.prepareStatement(
                "INSERT OR IGNORE INTO citations (entry_id, cited_by, context) VALUES (?, 'mem_search', 'auto-cited from search results')"
            )
            for (id in ids) {
                accessStmt.setLong(1, id); accessStmt.addBatch()
                citeStmt.setLong(1, id); citeStmt.addBatch()
            }
            accessStmt.executeBatch(); citeStmt.executeBatch()
        } catch (_: Exception) { /* must not break search */ }
    }

    private fun logSearchForAnalytics(query: String, result: String) {
        if (query.isBlank()) return
        try {
            val resultCount = Regex("""Found (\d+) results""").find(result)
                ?.groupValues?.get(1)?.toIntOrNull() ?: 0
            com.codeintel.memory.tools.v2.KbAnalyticsTool(engine.connection)
                .logSearch(query, resultCount)
        } catch (_: Exception) { /* analytics should not break search */ }
    }

    /** Public entry for external callers (e.g., code_search). */
    fun logSearchForAnalytics(query: String, resultCount: Int) {
        if (query.isBlank()) return
        try {
            com.codeintel.memory.tools.v2.KbAnalyticsTool(engine.connection)
                .logSearch(query, resultCount)
        } catch (_: Exception) { /* analytics should not break search */ }
    }

    private fun executeIngest(args: JsonObject): String {
        val result = KbIngestTool(pipeline).execute(args)
        engine.currentSessionId?.let { engine.sessions.incrementObservations(it) }
        audit.log("INGEST", sessionId = engine.currentSessionId, details = result.take(200))
        val source = args["source"]?.jsonPrimitive?.content
        autoScoreAndOwn(result, source)
        return result
    }

    /** Auto-score and set owner for newly ingested entry. */
    private fun autoScoreAndOwn(ingestResult: String, source: String?) {
        try {
            val id = Regex("""id=(\d+)""").find(ingestResult)?.groupValues?.get(1)?.toLongOrNull() ?: return
            val conn = engine.connection
            // Set owner based on source
            val owner = inferOwner(source)
            if (owner.isNotBlank()) {
                conn.prepareStatement("UPDATE knowledge_entries SET owner = ? WHERE id = ? AND (owner IS NULL OR owner = '')")
                    .use { it.setString(1, owner); it.setLong(2, id); it.executeUpdate() }
            }
            // Quality score
            val stmt = conn.prepareStatement(
                "SELECT content, tags, owner, access_count FROM knowledge_entries WHERE id = ?"
            )
            stmt.setLong(1, id)
            val rs = stmt.executeQuery()
            if (!rs.next()) { stmt.close(); return }
            val content = rs.getString("content") ?: ""
            val tags = rs.getString("tags") ?: ""
            val entryOwner = rs.getString("owner") ?: ""
            val accessCount = rs.getInt("access_count")
            stmt.close()
            val lenScore = when { content.length > 500 -> 30; content.length > 200 -> 20; content.length > 50 -> 10; else -> 5 }
            val tagScore = if (tags.isNotBlank()) 20 else 0
            val ownerScore = if (entryOwner.isNotBlank()) 15 else 0
            val structScore = if (content.contains("\n") && (content.contains("#") || content.contains("-"))) 20 else 10
            val accessScore = (accessCount.coerceAtMost(10) * 1.5).toInt()
            val total = (lenScore + tagScore + ownerScore + structScore + accessScore).coerceAtMost(100)
            conn.prepareStatement(
                "INSERT OR REPLACE INTO quality_scores (entry_id, total_score, dimensions, scored_at) VALUES (?, ?, '{}', datetime('now'))"
            ).use { it.setLong(1, id); it.setInt(2, total); it.executeUpdate() }
        } catch (_: Exception) { /* must not break ingest */ }
    }

    private fun inferOwner(source: String?): String {
        if (source == null) return "system"
        val s = source.lowercase()
        return when {
            "ba" in s || "brd" in s || "fsd" in s -> "ba-agent"
            "sa" in s || "tdd" in s || "architect" in s -> "sa-agent"
            "qa" in s || "stp" in s || "stc" in s || "test" in s -> "qa-agent"
            "dev" in s || "implement" in s || "code" in s -> "dev-agent"
            "devops" in s || "deploy" in s || "release" in s -> "devops-agent"
            "security" in s || "audit" in s -> "security-agent"
            "ui" in s || "design" in s || "wireframe" in s -> "ui-agent"
            "sm" in s || "scrum" in s -> "sm-agent"
            "ta" in s || "technical" in s -> "ta-agent"
            "chat" in s || "user" in s -> "user"
            "hook" in s || "tool-call" in s -> "system"
            else -> "system"
        }
    }

    private fun executeIngestFile(args: JsonObject): String {
        val filePath = args["file_path"]?.jsonPrimitive?.content
            ?: return "Error: file_path required"
        val type = args["type"]?.jsonPrimitive?.content ?: "CONTEXT"
        val format = args["format"]?.jsonPrimitive?.content ?: "markdown"

        val result = fileExecutor.ingest(filePath, type, format)
            ?: return "Error: file not found — $filePath (workspace=$workspace)"

        // File was skipped (unchanged)
        if (result.skipped) {
            val msg = "Skipped: $filePath — ${result.skipReason}"
            audit.log("INGEST_FILE_SKIP", sessionId = engine.currentSessionId, details = msg.take(200))
            return msg
        }

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
