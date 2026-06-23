/** Graph edge data class. KSA-173. */
package com.codeintel.graph.engine.model

data class EdgeMetadata(
    val callType: CallType? = null,
    val confidence: Float = 1.0f,
    val sourcePosition: Position? = null,
    val isConditional: Boolean = false
)

data class GraphEdge(
    val id: String = "",
    val source: String,
    val target: String,
    val type: EdgeType,
    val metadata: EdgeMetadata = EdgeMetadata()
) {
    companion object {
        private var counter = 0L
        fun generateId(): String = "edge-${++counter}"
    }
}
