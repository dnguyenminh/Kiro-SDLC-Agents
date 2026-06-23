/** Data models for tier consolidation tracking. */
package com.codeintel.memory.models

import kotlinx.serialization.Serializable

/** Record of a consolidation event (tier promotion/demotion). */
@Serializable
data class ConsolidationRecord(
    val id: Long = 0,
    val entryId: Long,
    val fromTier: String,
    val toTier: String,
    val reason: String,
    val consolidatedAt: String = ""
)

/** Statistics for memory tiers. */
@Serializable
data class TierStats(
    val tier: String,
    val entryCount: Int,
    val avgConfidence: Double,
    val avgAccessCount: Double
)
