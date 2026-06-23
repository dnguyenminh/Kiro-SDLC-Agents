/** Complete graph structure. KSA-173. */
package com.codeintel.graph.engine.model

import com.codeintel.graph.engine.store.DirectedGraph

data class CodeGraph(
    val type: GraphType,
    val graph: DirectedGraph<GraphNode>,
    val metadata: GraphMetadata = GraphMetadata()
)
