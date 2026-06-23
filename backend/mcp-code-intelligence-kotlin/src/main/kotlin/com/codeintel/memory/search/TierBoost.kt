/** Tier-based score multiplier — SEMANTIC entries rank higher than WORKING. */
package com.codeintel.memory.search

object TierBoost {
    private val FACTORS = mapOf(
        "SEMANTIC" to 1.5,
        "PROCEDURAL" to 1.3,
        "EPISODIC" to 1.1,
        "WORKING" to 1.0
    )

    /** Get boost factor for a tier. Higher = ranked higher in results. */
    fun factor(tier: String?): Double = FACTORS[tier] ?: 1.0
}
