/** Graph node data class. KSA-173. */
package com.codeintel.graph.engine.model

data class GraphNode(
    val id: String,
    val type: NodeType,
    val name: String,
    val filePath: String,
    val position: Position? = null,
    val language: String = "unknown",
    val visibility: Visibility? = null,
    val metadata: Map<String, Any> = emptyMap()
)
