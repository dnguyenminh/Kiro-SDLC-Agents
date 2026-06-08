/** Data models for contradiction detection and resolution. */
package com.codeintel.memory.contradiction

/** A detected contradiction between new and existing entries. */
data class ContradictionDetection(
    val newEntryId: Long,
    val conflictingEntryIds: List<Long>,
    val signal: String,
    val confidence: Double
)

/** Result of running contradiction resolution on ingest. */
data class ResolutionResult(
    val detected: List<ContradictionDetection> = emptyList(),
    val resolved: Int = 0,
    val supersededEntries: List<Long> = emptyList(),
    val edgesCreated: Int = 0
)

/** Stats for diagnostics. */
data class ContradictionStats(
    val totalSuperseded: Int,
    val totalActive: Int,
    val supersedesEdges: Int
)
