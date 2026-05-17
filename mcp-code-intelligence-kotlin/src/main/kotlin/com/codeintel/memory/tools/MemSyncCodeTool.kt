/** mem_sync_code tool — ingest code symbols into memory + create cross-reference edges. */
package com.codeintel.memory.tools

import com.codeintel.log
import com.codeintel.memory.MemoryEngine
import com.codeintel.memory.graph.KnowledgeGraph
import com.codeintel.memory.models.KnowledgeEntry
import com.codeintel.memory.models.MemoryTier
import com.codeintel.query.QueryLayer
import com.codeintel.query.SymbolResult
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive

class MemSyncCodeTool(
    private val engine: MemoryEngine,
    private val queryLayer: QueryLayer,
    private val graph: KnowledgeGraph
) {

    /** Sync code symbols into memory graph. */
    fun execute(args: JsonObject): String {
        val limit = args["limit"]?.jsonPrimitive?.int ?: 10000
        val kind = args["kind"]?.jsonPrimitive?.content

        val symbols = fetchSymbols(kind, limit)
        if (symbols.isEmpty()) return "No code symbols found to sync."

        val created = ingestSymbols(symbols)
        val linked = linkToDocuments(created)

        log("mem_sync_code: ${created.size} symbols ingested, $linked cross-references created")
        return "Synced: ${created.size} code symbols, $linked cross-reference edges"
    }

    private fun fetchSymbols(kind: String?, limit: Int): List<SymbolResult> {
        return if (kind != null) {
            queryLayer.findSymbols("", kind, limit)
        } else {
            // Get classes + interfaces (high-level entities)
            val classes = queryLayer.findSymbols("", "class", limit / 2)
            val interfaces = queryLayer.findSymbols("", "interface", limit / 2)
            classes + interfaces
        }
    }

    private fun ingestSymbols(symbols: List<SymbolResult>): List<Pair<Long, SymbolResult>> {
        val results = mutableListOf<Pair<Long, SymbolResult>>()
        for (sym in symbols) {
            if (isAlreadyIngested(sym)) continue
            val id = createCodeEntry(sym)
            results.add(Pair(id, sym))
        }
        return results
    }

    private fun isAlreadyIngested(sym: SymbolResult): Boolean {
        val existing = engine.search.search("${sym.name}", 3)
        return existing.any { r -> r.entry.type == "CODE_ENTITY" && r.entry.source == sym.filePath }
    }

    private fun createCodeEntry(sym: SymbolResult): Long {
        val content = buildContent(sym)
        val summary = "${sym.kind}: ${sym.name} (${sym.filePath})"
        val entry = KnowledgeEntry(
            content = content,
            summary = summary,
            type = "CODE_ENTITY",
            tier = MemoryTier.SEMANTIC.name,
            source = sym.filePath,
            sourceRef = "L${sym.startLine}-${sym.endLine}",
            tags = "${sym.kind},${sym.name},code"
        )
        return engine.knowledge.insert(entry)
    }

    private fun buildContent(sym: SymbolResult): String {
        val parts = mutableListOf<String>()
        parts.add("${sym.kind} ${sym.name}")
        if (sym.signature != null) parts.add("Signature: ${sym.signature}")
        parts.add("File: ${sym.filePath} (lines ${sym.startLine}-${sym.endLine})")
        if (sym.parentSymbol != null) parts.add("Parent: ${sym.parentSymbol}")
        if (sym.docComment != null) parts.add("Doc: ${sym.docComment}")
        return parts.joinToString("\n")
    }

    private fun linkToDocuments(codeEntries: List<Pair<Long, SymbolResult>>): Int {
        var edgeCount = 0
        for ((codeId, sym) in codeEntries) {
            val related = findRelatedDocEntries(sym.name)
            for (docId in related) {
                graph.addEdgeIfNotExists(codeId, docId, "IMPLEMENTED_BY")
                edgeCount++
            }
        }
        return edgeCount
    }

    private fun findRelatedDocEntries(symbolName: String): List<Long> {
        val results = engine.search.search(symbolName, 5)
        return results
            .filter { r -> r.entry.type != "CODE_ENTITY" }
            .map { r -> r.entry.id }
            .take(3)
    }
}
