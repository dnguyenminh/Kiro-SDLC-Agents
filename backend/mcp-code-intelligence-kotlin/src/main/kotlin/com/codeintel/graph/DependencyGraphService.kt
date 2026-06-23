/** Dependency Graph Service — BFS traversal on import relationships. KSA-173. */
package com.codeintel.graph

import com.codeintel.graph.models.DependencyMetadata
import com.codeintel.graph.models.DependencyNode
import com.codeintel.graph.models.DependencyResult
import java.sql.Connection
import java.util.ArrayDeque

class DependencyGraphService(
    private val conn: Connection,
    private val fileResolver: FileResolver,
) {

    /** Query dependency graph with direction and depth control. */
    fun query(
        file: String,
        direction: String = "outgoing",
        depth: Int = 1,
        includeExternal: Boolean = false,
        limit: Int = 50,
    ): DependencyResult {
        val startTime = System.currentTimeMillis()
        val clampedDepth = depth.coerceIn(1, 5)

        val resolved = fileResolver.resolveFile(file) ?: return fileNotFound(file)

        val (results, cycles) = if (direction == "both") {
            val out = bfsTraversal(resolved, "outgoing", clampedDepth, includeExternal, limit)
            val inc = bfsTraversal(resolved, "incoming", clampedDepth, includeExternal, limit)
            mergeResults(out.first, inc.first) to (out.second + inc.second)
        } else {
            bfsTraversal(resolved, direction, clampedDepth, includeExternal, limit)
        }

        val elapsed = System.currentTimeMillis() - startTime
        val maxD = results.maxOfOrNull { it.depth } ?: 0

        return DependencyResult(
            root = resolved,
            direction = direction,
            results = results,
            cycles = cycles,
            metadata = DependencyMetadata(
                totalNodes = results.size,
                maxDepthReached = minOf(clampedDepth, maxD),
                truncated = results.size >= limit,
                queryTimeMs = elapsed,
                externalCount = results.count { it.isExternal },
            ),
        )
    }

    private fun bfsTraversal(
        root: String, direction: String, maxDepth: Int,
        includeExternal: Boolean, limit: Int,
    ): Pair<List<DependencyNode>, List<List<String>>> {
        val visited = mutableSetOf(root)
        val results = mutableListOf<DependencyNode>()
        val cycles = mutableListOf<List<String>>()
        val queue = ArrayDeque<Triple<String, Int, List<String>>>()
        queue.add(Triple(root, 0, listOf(root)))

        while (queue.isNotEmpty() && results.size < limit) {
            val (current, currentDepth, currentPath) = queue.poll()
            if (currentDepth >= maxDepth) continue

            val deps = if (direction == "outgoing") getOutgoingDeps(current) else getIncomingDeps(current)

            for ((target, symbols) in deps) {
                val isExternal = fileResolver.isExternal(target)
                if (isExternal && !includeExternal) continue

                val resolvedTarget = if (isExternal) target
                    else fileResolver.resolveImportTarget(current, target) ?: continue

                if (resolvedTarget in currentPath) {
                    cycles.add(currentPath + resolvedTarget)
                    continue
                }

                if (resolvedTarget !in visited) {
                    visited.add(resolvedTarget)
                    results.add(DependencyNode(resolvedTarget, currentDepth + 1, symbols, isExternal))

                    if (!isExternal && currentDepth + 1 < maxDepth) {
                        queue.add(Triple(resolvedTarget, currentDepth + 1, currentPath + resolvedTarget))
                    }
                }
            }
        }
        return results to cycles
    }

    private fun getOutgoingDeps(filePath: String): List<Pair<String, List<String>>> {
        val stmt = conn.prepareStatement(
            "SELECT target_symbol FROM relationships WHERE file_path = ? AND kind = 'imports' ORDER BY line"
        )
        stmt.setString(1, filePath)
        val rs = stmt.executeQuery()

        val grouped = linkedMapOf<String, MutableList<String>>()
        while (rs.next()) {
            val targetSymbol = rs.getString(1)
            val module = extractModule(targetSymbol)
            val symbol = extractSymbolName(targetSymbol)
            grouped.getOrPut(module) { mutableListOf() }.also { if (symbol.isNotEmpty()) it.add(symbol) }
        }
        return grouped.map { (k, v) -> k to v }
    }

    private fun getIncomingDeps(filePath: String): List<Pair<String, List<String>>> {
        val basename = filePath.substringAfterLast("/").substringBeforeLast(".")
        val stmt = conn.prepareStatement("""
            SELECT DISTINCT file_path, target_symbol FROM relationships
            WHERE kind = 'imports' AND (target_symbol LIKE ? OR target_symbol LIKE ? OR target_symbol LIKE ?)
        """.trimIndent())
        stmt.setString(1, "%/$basename")
        stmt.setString(2, "%$basename%")
        stmt.setString(3, filePath)
        val rs = stmt.executeQuery()

        val grouped = linkedMapOf<String, MutableList<String>>()
        while (rs.next()) {
            val fp = rs.getString(1)
            if (fp == filePath) continue
            val sym = extractSymbolName(rs.getString(2)).ifEmpty { "*" }
            grouped.getOrPut(fp) { mutableListOf() }.add(sym)
        }
        return grouped.map { (k, v) -> k to v }
    }

    private fun extractModule(targetSymbol: String): String {
        val lastDot = targetSymbol.lastIndexOf('.')
        if (lastDot > 0 && "/" !in targetSymbol) return targetSymbol
        if (lastDot > 0) return targetSymbol.substring(0, lastDot)
        return targetSymbol
    }

    private fun extractSymbolName(targetSymbol: String): String {
        val lastDot = targetSymbol.lastIndexOf('.')
        if (lastDot in 1 until targetSymbol.length - 1) return targetSymbol.substring(lastDot + 1)
        return targetSymbol.substringAfterLast("/")
    }

    private fun mergeResults(a: List<DependencyNode>, b: List<DependencyNode>): List<DependencyNode> {
        val seen = mutableSetOf<String>()
        return (a + b).filter { seen.add(it.file) }
    }

    private fun fileNotFound(file: String) = DependencyResult(root = file, direction = "outgoing")
}
