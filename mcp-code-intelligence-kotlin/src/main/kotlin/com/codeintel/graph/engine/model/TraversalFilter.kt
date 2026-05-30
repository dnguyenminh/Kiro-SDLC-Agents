/** Traversal filter criteria. KSA-173. */
package com.codeintel.graph.engine.model

data class TraversalFilter(
    val nodeTypes: Set<NodeType> = emptySet(),
    val edgeTypes: Set<EdgeType> = emptySet(),
    val pathPrefix: String? = null
) {
    fun matches(nodeId: String, node: GraphNode?): Boolean {
        if (nodeTypes.isNotEmpty() && node != null && node.type !in nodeTypes) return false
        if (pathPrefix != null && !nodeId.startsWith(pathPrefix)) return false
        return true
    }
}
