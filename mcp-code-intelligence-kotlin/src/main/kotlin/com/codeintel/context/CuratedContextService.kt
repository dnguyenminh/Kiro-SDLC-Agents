/** Curated Context Service — NL query → search → RRF merge → budget allocation. KSA-171. */
package com.codeintel.context

import com.codeintel.context.models.*
import com.codeintel.graph.GraphTraverser
import com.codeintel.graph.SymbolResolver
import com.codeintel.query.QueryLayer
import java.sql.Connection

class CuratedContextService(
    private val conn: Connection,
    private val queryLayer: QueryLayer,
    private val traverser: GraphTraverser,
    private val resolver: SymbolResolver,
) {
    private val analyzer = QueryAnalyzer()
    private val merger = RRFMerger()
    private val allocator = BudgetAllocator()

    /** Execute curated context search with NL query. */
    fun getContext(params: CuratedContextParams): CuratedContextResponse {
        val startTime = System.currentTimeMillis()

        // 1. Analyze query
        val analysis = analyzer.analyze(params.query)

        // 2. Search sources
        val codeResults = if (params.includeSource) searchCode(analysis) else emptyList()
        val memoryResults = if (params.includeMemory) searchMemory(analysis) else emptyList()

        // 3. Graph expansion
        val graphResults = if (params.includeGraph && codeResults.isNotEmpty()) {
            expandGraph(codeResults.take(5))
        } else emptyList()

        // 4. Merge with RRF
        val sources = mapOf("code" to codeResults, "memory" to memoryResults, "graph" to graphResults)
        val merged = merger.merge(sources, params.sourceWeights)

        // 5. Allocate token budget
        val allocated = allocator.allocate(merged, params.maxTokens)

        // 6. Format response
        val sections = formatSections(allocated)
        val tokensUsed = allocated.sumOf { it.tokens } + 100

        val sourcesQueried = mutableListOf<String>()
        if (params.includeSource) sourcesQueried.add("code")
        if (params.includeMemory) sourcesQueried.add("memory")
        if (params.includeGraph) sourcesQueried.add("graph")

        return CuratedContextResponse(
            query = params.query,
            sections = sections,
            metadata = CuratedMetadata(
                tokensUsed = tokensUsed,
                tokensBudget = params.maxTokens,
                sourcesQueried = sourcesQueried,
                totalCandidates = codeResults.size + memoryResults.size + graphResults.size,
                resultsReturned = allocated.size,
                executionTimeMs = System.currentTimeMillis() - startTime,
            ),
        )
    }

    private fun searchCode(analysis: QueryAnalysis): List<Map<String, Any?>> {
        return try {
            val ftsResults = queryLayer.searchCode(analysis.ftsQuery, 30)
            val ftsItems = ftsResults.map { r ->
                mapOf<String, Any?>("name" to r.name, "kind" to r.kind, "file" to r.filePath, "line" to r.startLine, "signature" to r.signature)
            }

            val symbolItems = mutableListOf<Map<String, Any?>>()
            for (candidate in analysis.symbolCandidates.take(5)) {
                val resolved = resolver.resolve(candidate)
                for (sym in resolved.take(3)) {
                    symbolItems.add(mapOf("id" to sym.id, "name" to sym.name, "kind" to sym.kind, "file" to sym.filePath, "line" to sym.line))
                }
            }

            miniRRF(ftsItems, symbolItems).take(20)
        } catch (_: Exception) { emptyList() }
    }

    private fun searchMemory(analysis: QueryAnalysis): List<Map<String, Any?>> {
        return try {
            val query = analysis.keywords.take(5).joinToString(" ")
            val stmt = conn.prepareStatement("""
                SELECT id, content, summary, type FROM knowledge_entries
                WHERE id IN (SELECT rowid FROM knowledge_fts WHERE knowledge_fts MATCH ?)
                ORDER BY created_at DESC LIMIT 10
            """.trimIndent())
            stmt.setString(1, query)
            val rs = stmt.executeQuery()
            val results = mutableListOf<Map<String, Any?>>()
            while (rs.next()) {
                results.add(mapOf(
                    "id" to rs.getInt(1),
                    "name" to (rs.getString(3) ?: rs.getString(2)?.take(50) ?: "entry"),
                    "kind" to (rs.getString(4) ?: "memory"),
                    "content" to (rs.getString(3) ?: rs.getString(2)?.take(200) ?: ""),
                ))
            }
            results
        } catch (_: Exception) { emptyList() }
    }

    private fun expandGraph(topSymbols: List<Map<String, Any?>>): List<Map<String, Any?>> {
        val expanded = mutableListOf<Map<String, Any?>>()
        val seen = mutableSetOf<String>()

        for (symbol in topSymbols) {
            try {
                val name = symbol["name"]?.toString() ?: continue
                val startNode = traverser.resolveNode(name) ?: continue
                val results = traverser.traverse(startNode, com.codeintel.graph.models.TraverseConfig(
                    edgeTypes = listOf("calls", "imports", "inherits"),
                    direction = "both", maxDepth = 1, maxResults = 5,
                ))
                for (r in results) {
                    val key = "${r.node.name}:${r.node.filePath}"
                    if (key in seen) continue
                    seen.add(key)
                    expanded.add(mapOf(
                        "id" to r.node.id, "name" to r.node.name,
                        "kind" to r.node.kind, "file" to r.node.filePath,
                        "line" to r.node.startLine,
                        "relationship" to "${r.edgeType} $name",
                    ))
                }
            } catch (_: Exception) { continue }
        }
        return expanded
    }

    private fun miniRRF(listA: List<Map<String, Any?>>, listB: List<Map<String, Any?>>): List<Map<String, Any?>> {
        val k = 60
        val scores = mutableMapOf<String, Pair<Double, Map<String, Any?>>>()

        for ((i, item) in listA.withIndex()) {
            val key = "${item["name"] ?: ""}:${item["file"] ?: ""}"
            scores[key] = (1.0 / (k + i)) to item
        }
        for ((i, item) in listB.withIndex()) {
            val key = "${item["name"] ?: ""}:${item["file"] ?: ""}"
            val existing = scores[key]
            if (existing != null) {
                scores[key] = (existing.first + 1.0 / (k + i)) to existing.second
            } else {
                scores[key] = (1.0 / (k + i)) to item
            }
        }

        return scores.values.sortedByDescending { it.first }.map { it.second }
    }

    private fun formatSections(allocated: List<AllocatedResult>): List<ContextSection> {
        val bySource = mutableMapOf<String, MutableList<ContextItem>>()

        for (item in allocated) {
            val source = item.sources.firstOrNull() ?: "code"
            bySource.getOrPut(source) { mutableListOf() }.add(ContextItem(
                name = item.name, kind = item.kind, file = item.file,
                line = item.line, relevance = item.relevanceScore,
                detail = item.detail, content = item.content,
                relationship = item.relationship,
            ))
        }

        val titleMap = mapOf("code" to "Code Symbols", "memory" to "Knowledge Base", "graph" to "Related (Graph)")
        return bySource.map { (source, items) ->
            ContextSection(title = titleMap[source] ?: source, source = source, items = items)
        }
    }
}
