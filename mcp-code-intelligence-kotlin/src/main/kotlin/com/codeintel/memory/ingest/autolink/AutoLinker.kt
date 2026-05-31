/** AutoLinker orchestrator — runs strategies, dedup, commit. KSA-190. */
package com.codeintel.memory.ingest.autolink

import com.codeintel.log
import com.codeintel.memory.graph.KnowledgeGraph
import com.codeintel.memory.models.GraphEdge
import com.codeintel.memory.repository.GraphRepository
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.sql.Connection

class AutoLinker(
    private val graph: KnowledgeGraph,
    private val graphRepo: GraphRepository,
    private val conn: Connection,
    private val strategies: List<LinkingStrategy>,
    private val config: AutoLinkConfig = defaultAutoLinkConfig()
) {
    private val json = Json { encodeDefaults = true }

    /** Link a single entry to related entries. Fire-and-forget safe. */
    fun link(entryId: Long): AutoLinkResult {
        if (!config.enabled) return emptyResult(entryId)
        val start = System.currentTimeMillis()
        val candidates = collectCandidates(entryId)
        val deduped = dedup(entryId, candidates)
        val capped = deduped.take(config.totalMaxEdges)
        val (created, skipped) = commitEdges(entryId, capped)
        val timeMs = System.currentTimeMillis() - start
        log("[auto-link] Entry #$entryId: $created edges (${timeMs}ms)")
        return AutoLinkResult(entryId, created, countByType(capped), skipped, timeMs)
    }

    /** Batch backfill: link orphan entries (no edges). */
    fun backfill(entryId: Long? = null, limit: Int = 50): String {
        if (entryId != null) {
            val result = link(entryId)
            return "Auto-linked #$entryId: ${result.edgesCreated} edges (${result.timeMs}ms)"
        }
        val orphans = findOrphans(limit)
        var totalEdges = 0
        for (id in orphans) totalEdges += link(id).edgesCreated
        return "Backfill: ${orphans.size} entries, $totalEdges edges created"
    }

    private fun collectCandidates(entryId: Long): List<CandidateEdge> {
        val all = mutableListOf<CandidateEdge>()
        for (strategy in strategies) {
            if (!strategy.isEnabled(config)) continue
            if (strategy.name == "fts" && all.size >= config.fts.fallbackThreshold) continue
            try {
                all.addAll(strategy.findCandidates(entryId, config))
            } catch (e: Exception) {
                log("[auto-link] ${strategy.name} failed for #$entryId: $e")
            }
        }
        return all
    }

    private fun commitEdges(entryId: Long, edges: List<CandidateEdge>): Pair<Int, Int> {
        var created = 0; var skipped = 0
        for (edge in edges) {
            try {
                if (edgeExistsBidirectional(entryId, edge.targetId, edge.relation)) {
                    skipped++
                } else {
                    val meta = json.encodeToString(
                        edge.metadata.mapValues { it.value.toString() }
                    )
                    graph.addEdge(GraphEdge(
                        sourceId = entryId,
                        targetId = edge.targetId,
                        relation = edge.relation,
                        weight = edge.score,
                        metadata = meta
                    ))
                    created++
                }
            } catch (e: Exception) {
                log("[auto-link] commit failed #$entryId->#${edge.targetId}: $e")
            }
        }
        return created to skipped
    }

    private fun dedup(sourceId: Long, candidates: List<CandidateEdge>): List<CandidateEdge> {
        val sorted = candidates
            .filter { it.targetId != sourceId }
            .sortedByDescending { it.score }
        val seen = mutableSetOf<String>()
        return sorted.filter { seen.add("${it.targetId}:${it.relation}") }
    }

    private fun edgeExistsBidirectional(src: Long, tgt: Long, relation: String): Boolean {
        val sql = """
            SELECT 1 FROM knowledge_graph_edges
            WHERE ((source_id = ? AND target_id = ?) OR (source_id = ? AND target_id = ?))
            AND relation = ? LIMIT 1
        """.trimIndent()
        conn.prepareStatement(sql).use { ps ->
            ps.setLong(1, src); ps.setLong(2, tgt)
            ps.setLong(3, tgt); ps.setLong(4, src)
            ps.setString(5, relation)
            val rs = ps.executeQuery()
            return rs.next()
        }
    }

    private fun findOrphans(limit: Int): List<Long> {
        val sql = """
            SELECT ke.id FROM knowledge_entries ke
            WHERE ke.archived_at IS NULL
            AND ke.id NOT IN (
                SELECT source_id FROM knowledge_graph_edges
                UNION SELECT target_id FROM knowledge_graph_edges
            ) LIMIT ?
        """.trimIndent()
        conn.prepareStatement(sql).use { ps ->
            ps.setInt(1, limit)
            val rs = ps.executeQuery()
            val ids = mutableListOf<Long>()
            while (rs.next()) ids.add(rs.getLong(1))
            return ids
        }
    }

    private fun countByType(edges: List<CandidateEdge>): LinkBreakdown {
        var s = 0; var e = 0; var t = 0; var f = 0
        for (edge in edges) when (edge.relation) {
            AutoLinkRelations.SIMILAR_TO -> s++
            AutoLinkRelations.SHARES_ENTITY -> e++
            AutoLinkRelations.SHARES_TAG -> t++
            AutoLinkRelations.TOPIC_OVERLAP -> f++
        }
        return LinkBreakdown(s, e, t, f)
    }

    private fun emptyResult(entryId: Long) = AutoLinkResult(
        entryId, 0, LinkBreakdown(), 0, 0
    )
}
