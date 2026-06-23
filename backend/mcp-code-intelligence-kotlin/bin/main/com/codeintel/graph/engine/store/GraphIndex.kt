/** Fast lookup indices for graph queries. KSA-173. */
package com.codeintel.graph.engine.store

import com.codeintel.graph.engine.model.GraphNode
import com.codeintel.graph.engine.model.NodeType
import java.util.concurrent.ConcurrentHashMap

class GraphIndex {
    private val byFile: MutableMap<String, MutableSet<String>> = ConcurrentHashMap()
    private val byType: MutableMap<NodeType, MutableSet<String>> = ConcurrentHashMap()
    private val byName: MutableMap<String, MutableSet<String>> = ConcurrentHashMap()

    fun index(node: GraphNode) {
        byFile.getOrPut(node.filePath) { ConcurrentHashMap.newKeySet() }.add(node.id)
        byType.getOrPut(node.type) { ConcurrentHashMap.newKeySet() }.add(node.id)
        byName.getOrPut(node.name) { ConcurrentHashMap.newKeySet() }.add(node.id)
    }

    fun remove(node: GraphNode) {
        byFile[node.filePath]?.remove(node.id)
        byType[node.type]?.remove(node.id)
        byName[node.name]?.remove(node.id)
    }

    fun getByFile(filePath: String): Set<String> = byFile[filePath] ?: emptySet()

    fun getByType(type: NodeType): Set<String> = byType[type] ?: emptySet()

    fun getByName(name: String): Set<String> = byName[name] ?: emptySet()

    fun clear() {
        byFile.clear()
        byType.clear()
        byName.clear()
    }
}
