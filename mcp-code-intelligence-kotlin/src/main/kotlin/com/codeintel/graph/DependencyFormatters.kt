/** Dependency Formatters — tree/flat/graph output formats. KSA-173. */
package com.codeintel.graph

import com.codeintel.graph.models.DependencyNode
import com.codeintel.graph.models.DependencyResult

object DependencyFormatters {

    /** Format a DependencyResult into the requested output format. */
    fun format(result: DependencyResult, fmt: String = "tree"): Map<String, Any> = when (fmt) {
        "flat" -> toFlatFormat(result)
        "graph" -> toGraphFormat(result)
        else -> toTreeFormat(result)
    }

    fun toTreeFormat(result: DependencyResult): Map<String, Any> {
        val byDepth = result.results.groupBy { it.depth }
        val tree = mapOf(
            "file" to result.root,
            "label" to result.root.substringAfterLast("/"),
            "depth" to 0,
            "importedSymbols" to emptyList<String>(),
            "isExternal" to false,
            "children" to buildChildren(byDepth, 1),
        )
        return mapOf("root" to result.root, "tree" to tree, "cycles" to result.cycles, "metadata" to metadataMap(result))
    }

    fun toFlatFormat(result: DependencyResult): Map<String, Any> = mapOf(
        "root" to result.root,
        "direction" to result.direction,
        "dependencies" to result.results.map { mapOf(
            "file" to it.file, "depth" to it.depth,
            "importedSymbols" to it.importedSymbols, "isExternal" to it.isExternal,
        )},
        "cycles" to result.cycles,
        "metadata" to metadataMap(result),
    )

    fun toGraphFormat(result: DependencyResult): Map<String, Any> {
        val nodes = listOf(
            mapOf("id" to result.root, "label" to result.root.substringAfterLast("/"), "depth" to 0, "isExternal" to false)
        ) + result.results.map { mapOf("id" to it.file, "label" to it.file.substringAfterLast("/"), "depth" to it.depth, "isExternal" to it.isExternal) }

        val edges = result.results.filter { it.depth == 1 }.map {
            mapOf("from" to result.root, "to" to it.file, "symbols" to it.importedSymbols)
        }
        return mapOf("nodes" to nodes, "edges" to edges, "cycles" to result.cycles, "metadata" to metadataMap(result))
    }

    private fun buildChildren(byDepth: Map<Int, List<DependencyNode>>, depth: Int): List<Map<String, Any>> {
        val nodes = byDepth[depth] ?: return emptyList()
        return nodes.map { mapOf(
            "file" to it.file,
            "label" to it.file.substringAfterLast("/"),
            "depth" to it.depth,
            "importedSymbols" to it.importedSymbols,
            "isExternal" to it.isExternal,
            "children" to buildChildren(byDepth, depth + 1),
        )}
    }

    private fun metadataMap(result: DependencyResult): Map<String, Any> = mapOf(
        "totalNodes" to result.metadata.totalNodes,
        "maxDepthReached" to result.metadata.maxDepthReached,
        "truncated" to result.metadata.truncated,
        "queryTimeMs" to result.metadata.queryTimeMs,
        "externalCount" to result.metadata.externalCount,
    )
}
