/** Graph engine configuration. KSA-173. */
package com.codeintel.graph.engine

data class GraphEngineConfig(
    val maxNodes: Int = 50_000,
    val maxDepth: Int = 100,
    val defaultDepth: Int = 10,
    val incrementalThreshold: Double = 0.3,
    val batchSize: Int = 100,
    val betweennessSampleSize: Int = 50
)
