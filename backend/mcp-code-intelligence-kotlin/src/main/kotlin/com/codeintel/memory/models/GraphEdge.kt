/** Data models for knowledge graph edges. */
package com.codeintel.memory.models

import kotlinx.serialization.Serializable

/** Relationship type between knowledge entries. */
enum class EdgeRelation {
    RELATES_TO, DEPENDS_ON, CONTRADICTS, SUPERSEDES,
    DERIVED_FROM, IMPLEMENTS, CAUSED_BY, RESOLVES
}

/** An edge in the knowledge graph connecting two entries. */
@Serializable
data class GraphEdge(
    val id: Long = 0,
    val sourceId: Long,
    val targetId: Long,
    val relation: String,
    val weight: Double = 1.0,
    val metadata: String? = null,
    val createdAt: String = ""
)

/** A node with its connections for graph traversal. */
@Serializable
data class GraphNode(
    val entryId: Long,
    val summary: String,
    val tier: String,
    val edges: List<GraphEdge> = emptyList()
)
