/** Graph analyzer — server-side graph structure analysis for KB. */
package com.codeintel.http

import kotlinx.serialization.Serializable
import java.sql.Connection
import java.time.Instant
import java.time.temporal.ChronoUnit

class GraphAnalyzer(private val conn: Connection) {

    fun analyze(): GraphAnalysisResult {
        val stats = computeStats()
        val insights = mutableListOf<GraphInsight>()
        insights.addAll(findOrphans())
        insights.addAll(findHubs())
        insights.addAll(findClusters())
        insights.addAll(findStaleNodes())
        return GraphAnalysisResult(insights, stats, Instant.now().toString())
    }

    private fun computeStats(): GraphStats {
        return runCatching {
            val nc = queryInt("SELECT COUNT(*) FROM knowledge_entries")
            val ec = queryInt("SELECT COUNT(*) FROM knowledge_graph_edges")
            val maxEdges = if (nc > 1) nc.toLong() * (nc - 1) else 1L
            val density = (ec.toDouble() / maxEdges * 10000).toLong() / 10000.0
            GraphStats(nc, ec, density)
        }.getOrDefault(GraphStats(0, 0, 0.0))
    }

    private fun findOrphans(): List<GraphInsight> {
        return runCatching {
            val rs = conn.createStatement().executeQuery(
                "SELECT e.id FROM knowledge_entries e WHERE e.id NOT IN (" +
                "  SELECT source_id FROM knowledge_graph_edges " +
                "  UNION SELECT target_id FROM knowledge_graph_edges) LIMIT 20"
            )
            val ids = buildList { while (rs.next()) add(rs.getLong("id")) }
            if (ids.isEmpty()) return emptyList()
            listOf(GraphInsight(
                type = "orphans", title = "${ids.size} Orphan Nodes",
                description = "Entries không có relationships nào",
                nodeIds = ids, severity = "warning",
                action = InsightAction("Find Related", "api/kb/entries/{id}/find-related", "POST"),
            ))
        }.getOrDefault(emptyList())
    }

    private fun findHubs(): List<GraphInsight> {
        return runCatching {
            val rs = conn.createStatement().executeQuery(
                "SELECT node_id, SUM(cnt) as total FROM (" +
                "  SELECT source_id AS node_id, COUNT(*) AS cnt FROM knowledge_graph_edges GROUP BY source_id" +
                "  UNION ALL" +
                "  SELECT target_id AS node_id, COUNT(*) AS cnt FROM knowledge_graph_edges GROUP BY target_id" +
                ") GROUP BY node_id HAVING total > 10 ORDER BY total DESC LIMIT 10"
            )
            val ids = buildList { while (rs.next()) add(rs.getLong("node_id")) }
            if (ids.isEmpty()) return emptyList()
            listOf(GraphInsight(
                type = "hubs", title = "${ids.size} Hub Nodes",
                description = "Entries có >10 relationships (highly connected)",
                nodeIds = ids, severity = "info", action = null,
            ))
        }.getOrDefault(emptyList())
    }

    private fun findClusters(): List<GraphInsight> {
        return runCatching {
            val edges = queryEdges()
            val nodeIds = queryNodeIds()
            if (nodeIds.isEmpty()) return emptyList()
            val adj = nodeIds.associateWith { mutableSetOf<Long>() }.toMutableMap()
            for ((src, tgt) in edges) {
                adj[src]?.add(tgt)
                adj[tgt]?.add(src)
            }
            val components = countComponents(adj)
            if (components <= 1) return emptyList()
            listOf(GraphInsight(
                type = "clusters", title = "$components Disconnected Clusters",
                description = "Graph có nhiều components tách biệt",
                nodeIds = emptyList(), severity = "info", action = null,
            ))
        }.getOrDefault(emptyList())
    }

    private fun findStaleNodes(): List<GraphInsight> {
        val threshold = Instant.now().minus(180, ChronoUnit.DAYS).toString()
        return runCatching {
            val stmt = conn.prepareStatement(
                "SELECT id FROM knowledge_entries WHERE updated_at < ? LIMIT 15"
            )
            stmt.setString(1, threshold)
            val rs = stmt.executeQuery()
            val ids = buildList { while (rs.next()) add(rs.getLong("id")) }
            if (ids.isEmpty()) return emptyList()
            listOf(GraphInsight(
                type = "stale", title = "${ids.size} Stale Nodes (>180 days)",
                description = "Entries chưa được update > 180 ngày",
                nodeIds = ids, severity = "warning",
                action = InsightAction("Review", "api/kb/entries/{id}/review", "POST"),
            ))
        }.getOrDefault(emptyList())
    }

    private fun queryInt(sql: String): Int {
        val rs = conn.createStatement().executeQuery(sql)
        rs.next()
        return rs.getInt(1)
    }

    private fun queryEdges(): List<Pair<Long, Long>> {
        val rs = conn.createStatement().executeQuery("SELECT source_id, target_id FROM knowledge_graph_edges")
        return buildList { while (rs.next()) add(rs.getLong("source_id") to rs.getLong("target_id")) }
    }

    private fun queryNodeIds(): Set<Long> {
        val rs = conn.createStatement().executeQuery("SELECT id FROM knowledge_entries")
        return buildSet { while (rs.next()) add(rs.getLong("id")) }
    }
}

/** Count connected components via BFS. */
private fun countComponents(adj: Map<Long, Set<Long>>): Int {
    val visited = mutableSetOf<Long>()
    var components = 0
    for (node in adj.keys) {
        if (node in visited) continue
        components++
        val queue = ArrayDeque<Long>()
        queue.add(node)
        while (queue.isNotEmpty()) {
            val current = queue.removeFirst()
            if (!visited.add(current)) continue
            adj[current]?.forEach { if (it !in visited) queue.add(it) }
        }
    }
    return components
}

@Serializable
data class GraphInsight(
    val type: String,
    val title: String,
    val description: String,
    val nodeIds: List<Long>,
    val severity: String,
    val action: InsightAction?,
)

@Serializable
data class InsightAction(val label: String, val endpoint: String, val method: String)

@Serializable
data class GraphStats(val nodeCount: Int, val edgeCount: Int, val density: Double)

@Serializable
data class GraphAnalysisResult(
    val insights: List<GraphInsight>,
    val stats: GraphStats,
    val computedAt: String,
)
