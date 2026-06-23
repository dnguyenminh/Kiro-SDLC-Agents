/** Analysis result models. KSA-173. */
package com.codeintel.graph.engine.model

data class AffectedNode(
    val nodeId: String,
    val distance: Int,
    val score: Double
)

data class ImpactResult(
    val target: String,
    val totalAffected: Int = 0,
    val directDependents: Int = 0,
    val affected: List<AffectedNode> = emptyList()
)

data class Cycle(
    val nodes: List<String>,
    val path: List<String> = emptyList(),
    val severity: CycleSeverity = CycleSeverity.WARNING
)

data class HotPathResult(
    val node: String,
    val inDegree: Int = 0,
    val outDegree: Int = 0,
    val betweenness: Double = 0.0,
    val compositeScore: Double = 0.0,
    val classification: String = "normal"
)

data class TraversalNode(
    val nodeId: String,
    val depth: Int
)

data class TraversalResult(
    val start: String,
    val algorithm: String,
    val direction: Direction,
    val results: List<TraversalNode> = emptyList()
)
