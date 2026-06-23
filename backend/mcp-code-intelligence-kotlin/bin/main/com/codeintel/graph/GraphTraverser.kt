/** Graph Traverser — generic BFS/DFS engine with edge/node type filtering. KSA-173. */
package com.codeintel.graph

import com.codeintel.graph.models.GraphNode
import com.codeintel.graph.models.TraverseConfig
import com.codeintel.graph.models.TraverseResponse
import com.codeintel.graph.models.TraverseResultItem
import java.io.File
import java.sql.Connection
import java.util.ArrayDeque

class GraphTraverser(
    private val conn: Connection,
    private val resolver: SymbolResolver,
    private val workspace: String,
) {

    /** Resolve a symbol identifier to a graph node. */
    fun resolveNode(identifier: String): GraphNode? {
        val resolved = resolver.resolve(identifier)
        if (resolved.isEmpty()) return null
        val r = resolved.first()
        return GraphNode(id = r.id, name = r.name, kind = r.kind, filePath = r.filePath, startLine = r.line)
    }

    /** BFS traversal from a start node with edge/node type filters. */
    fun traverse(startNode: GraphNode, config: TraverseConfig): List<TraverseResultItem> {
        val visited = mutableSetOf<Int>()
        val queue = ArrayDeque<Triple<GraphNode, Int, List<String>>>()
        queue.add(Triple(startNode, 0, listOf(startNode.name)))
        val results = mutableListOf<TraverseResultItem>()

        while (queue.isNotEmpty() && results.size < config.maxResults) {
            val (node, depth, currentPath) = queue.poll()
            if (node.id in visited) continue
            visited.add(node.id)

            if (depth > 0) {
                if (config.nodeTypes.isEmpty() || node.kind in config.nodeTypes) {
                    results.add(TraverseResultItem(node, depth, currentPath, node.incomingEdgeType ?: "unknown"))
                }
            }

            if (depth < config.maxDepth) {
                val neighbors = getNeighbors(node.id, config)
                for (neighbor in neighbors) {
                    if (neighbor.id !in visited) {
                        queue.add(Triple(neighbor, depth + 1, currentPath + neighbor.name))
                    }
                }
            }
        }

        return results.sortedBy { it.depth }
    }

    /** DFS traversal from a start node with edge/node type filters. */
    fun traverseDfs(startNode: GraphNode, config: TraverseConfig): List<TraverseResultItem> {
        val visited = mutableSetOf<Int>()
        val stack = ArrayDeque<Triple<GraphNode, Int, List<String>>>()
        stack.push(Triple(startNode, 0, listOf(startNode.name)))
        val results = mutableListOf<TraverseResultItem>()

        while (stack.isNotEmpty() && results.size < config.maxResults) {
            val (node, depth, currentPath) = stack.pop()
            if (node.id in visited) continue
            visited.add(node.id)

            if (depth > 0) {
                if (config.nodeTypes.isEmpty() || node.kind in config.nodeTypes) {
                    results.add(TraverseResultItem(node, depth, currentPath, node.incomingEdgeType ?: "unknown"))
                }
            }

            if (depth < config.maxDepth) {
                val neighbors = getNeighbors(node.id, config)
                for (neighbor in neighbors.reversed()) {
                    if (neighbor.id !in visited) {
                        stack.push(Triple(neighbor, depth + 1, currentPath + neighbor.name))
                    }
                }
            }
        }

        return results
    }

    /** Format traversal results into the MCP response format. */
    fun formatResponse(
        startNode: GraphNode,
        results: List<TraverseResultItem>,
        includeSource: Boolean = false,
        sourceLines: Int = 5,
        executionTimeMs: Long = 0,
    ): TraverseResponse {
        val formatted = results.map { r ->
            buildMap {
                put("name", r.node.name)
                put("kind", r.node.kind)
                put("file", r.node.filePath)
                put("line", r.node.startLine)
                put("depth", r.depth)
                put("edge_type", r.edgeType)
                if (includeSource) {
                    getSourceSnippet(r.node.filePath, r.node.startLine, sourceLines)?.let { put("source", it) }
                }
            }
        }

        return TraverseResponse(
            start = mapOf("name" to startNode.name, "kind" to startNode.kind, "file" to startNode.filePath, "line" to startNode.startLine),
            results = formatted,
            metadata = mapOf(
                "total_traversed" to results.size,
                "total_results" to formatted.size,
                "max_depth_reached" to (results.maxOfOrNull { it.depth } ?: 0),
                "truncated" to (results.size >= 50),
                "execution_time_ms" to executionTimeMs,
            ),
        )
    }

    private fun getNeighbors(nodeId: Int, config: TraverseConfig): List<GraphNode> {
        val edgeFilter = if (config.edgeTypes.isNotEmpty()) {
            "AND r.kind IN (${config.edgeTypes.joinToString(",") { "'$it'" }})"
        } else ""

        val rows = mutableListOf<GraphNode>()

        if (config.direction in listOf("outgoing", "both")) {
            val stmt = conn.prepareStatement("""
                SELECT s.id, s.name, s.kind, f.relative_path, s.start_line, r.kind
                FROM relationships r
                JOIN symbols s ON s.id = r.target_symbol_id
                JOIN files f ON s.file_id = f.id
                WHERE r.source_symbol_id = ? $edgeFilter LIMIT 100
            """.trimIndent())
            stmt.setInt(1, nodeId)
            val rs = stmt.executeQuery()
            while (rs.next()) {
                rows.add(GraphNode(rs.getInt(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getInt(5), rs.getString(6)))
            }
        }

        if (config.direction in listOf("incoming", "both")) {
            val stmt = conn.prepareStatement("""
                SELECT s.id, s.name, s.kind, f.relative_path, s.start_line, r.kind
                FROM relationships r
                JOIN symbols s ON s.id = r.source_symbol_id
                JOIN files f ON s.file_id = f.id
                WHERE r.target_symbol_id = ? $edgeFilter LIMIT 100
            """.trimIndent())
            stmt.setInt(1, nodeId)
            val rs = stmt.executeQuery()
            while (rs.next()) {
                rows.add(GraphNode(rs.getInt(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getInt(5), rs.getString(6)))
            }
        }

        return rows
    }

    private fun getSourceSnippet(filePath: String, startLine: Int, contextLines: Int): String? {
        return try {
            val fullPath = File(workspace, filePath)
            if (!fullPath.exists()) return null
            val lines = fullPath.readLines()
            val start = (startLine - 1).coerceAtLeast(0)
            val end = (start + contextLines).coerceAtMost(lines.size)
            lines.subList(start, end).joinToString("\n")
        } catch (_: Exception) { null }
    }
}
