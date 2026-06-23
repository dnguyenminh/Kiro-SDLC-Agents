/** Strategy interface and shared models for auto-linking. KSA-190. */
package com.codeintel.memory.ingest.autolink

import kotlinx.serialization.Serializable

/** A candidate edge proposed by a linking strategy. */
data class CandidateEdge(
    val targetId: Long,
    val relation: String,
    val score: Double,
    val metadata: Map<String, Any?> = emptyMap()
)

/** Result of auto-linking a single entry. */
@Serializable
data class AutoLinkResult(
    val entryId: Long,
    val edgesCreated: Int,
    val breakdown: LinkBreakdown,
    val skipped: Int,
    val timeMs: Long
)

/** Breakdown of edges by strategy type. */
@Serializable
data class LinkBreakdown(
    val semantic: Int = 0,
    val entity: Int = 0,
    val tag: Int = 0,
    val fts: Int = 0
)

/** Auto-link relation constants. */
object AutoLinkRelations {
    const val SIMILAR_TO = "SIMILAR_TO"
    const val SHARES_ENTITY = "SHARES_ENTITY"
    const val SHARES_TAG = "SHARES_TAG"
    const val TOPIC_OVERLAP = "TOPIC_OVERLAP"
}

/** Strategy interface — each linking method implements this. */
interface LinkingStrategy {
    val name: String
    fun isEnabled(config: AutoLinkConfig): Boolean
    fun findCandidates(entryId: Long, config: AutoLinkConfig): List<CandidateEdge>
}
