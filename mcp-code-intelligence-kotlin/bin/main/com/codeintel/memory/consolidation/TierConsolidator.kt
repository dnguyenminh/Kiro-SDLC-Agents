/** 4-Tier consolidation engine — promotes/demotes entries between tiers. */
package com.codeintel.memory.consolidation

import com.codeintel.log
import com.codeintel.memory.models.MemoryTier
import com.codeintel.memory.repository.ConsolidationRepository
import com.codeintel.memory.repository.KnowledgeRepository

/** Configuration for tier promotion/demotion thresholds. */
data class ConsolidationConfig(
    val workingToEpisodicAccess: Int = 3,
    val workingToEpisodicConfidence: Double = 0.7,
    val episodicToSemanticAccess: Int = 10,
    val episodicToSemanticConfidence: Double = 0.85,
    val semanticToProceduralAccess: Int = 25,
    val semanticToProceduralConfidence: Double = 0.95,
    val demotionInactiveDays: Int = 30
)

/** Result of a consolidation run. */
data class ConsolidationResult(
    val promoted: Int,
    val demoted: Int,
    val expired: Int
)

class TierConsolidator(
    private val knowledgeRepo: KnowledgeRepository,
    private val consolidationRepo: ConsolidationRepository,
    private val config: ConsolidationConfig = ConsolidationConfig()
) {

    /** Run full consolidation cycle across all tiers. */
    fun consolidate(): ConsolidationResult {
        val fixed = fixTierMismatches()
        val promoted = promoteEligible()
        val expired = expireStale()
        log("Consolidation: fixed=$fixed, promoted=$promoted, expired=$expired")
        return ConsolidationResult(promoted + fixed, 0, expired)
    }

    /** Fix entries whose tier doesn't match their type (legacy data). */
    private fun fixTierMismatches(): Int {
        val working = knowledgeRepo.findByTier(MemoryTier.WORKING.name, limit = 1000)
        var fixed = 0
        for (entry in working) {
            val correctTier = tierForType(entry.type)
            if (correctTier != MemoryTier.WORKING.name) {
                knowledgeRepo.updateTier(entry.id, correctTier)
                consolidationRepo.logTransition(entry.id, MemoryTier.WORKING.name, correctTier, "auto:tier_fix")
                fixed++
            }
        }
        return fixed
    }

    /** Determine correct tier based on knowledge type. */
    private fun tierForType(type: String): String = when (type) {
        "REQUIREMENT", "ARCHITECTURE", "PROCEDURE", "API_DESIGN" -> MemoryTier.SEMANTIC.name
        "DECISION", "LESSON_LEARNED" -> MemoryTier.EPISODIC.name
        "ERROR_PATTERN" -> MemoryTier.EPISODIC.name
        else -> MemoryTier.WORKING.name
    }

    /** Promote entries that meet threshold criteria. */
    private fun promoteEligible(): Int {
        var count = 0
        count += promoteFromTier(
            MemoryTier.WORKING.name, MemoryTier.EPISODIC.name,
            config.workingToEpisodicAccess, config.workingToEpisodicConfidence
        )
        count += promoteFromTier(
            MemoryTier.EPISODIC.name, MemoryTier.SEMANTIC.name,
            config.episodicToSemanticAccess, config.episodicToSemanticConfidence
        )
        count += promoteFromTier(
            MemoryTier.SEMANTIC.name, MemoryTier.PROCEDURAL.name,
            config.semanticToProceduralAccess, config.semanticToProceduralConfidence
        )
        return count
    }

    private fun promoteFromTier(fromTier: String, toTier: String, minAccess: Int, minConf: Double): Int {
        val candidates = consolidationRepo.findPromotionCandidates(fromTier, minAccess, minConf)
        for (id in candidates) {
            knowledgeRepo.updateTier(id, toTier)
            consolidationRepo.logTransition(id, fromTier, toTier, "auto:threshold_met")
        }
        return candidates.size
    }

    /** Remove expired entries. */
    private fun expireStale(): Int {
        // Only expire WORKING tier entries with expires_at set
        val working = knowledgeRepo.findByTier(MemoryTier.WORKING.name, limit = 500)
        var expired = 0
        for (entry in working) {
            if (entry.expiresAt != null && isExpired(entry.expiresAt)) {
                knowledgeRepo.delete(entry.id)
                expired++
            }
        }
        return expired
    }

    private fun isExpired(expiresAt: String): Boolean {
        return try {
            val now = java.time.LocalDateTime.now().toString()
            expiresAt < now
        } catch (_: Exception) { false }
    }
}
