/** Graph metadata and statistics. KSA-173. */
package com.codeintel.graph.engine.model

import java.time.Instant

data class GraphMetadata(
    val projectPath: String = "",
    val totalFiles: Int = 0,
    val totalNodes: Int = 0,
    val totalEdges: Int = 0,
    val buildTimeMs: Long = 0,
    val generation: Int = 0,
    val lastUpdated: Instant = Instant.now()
)
