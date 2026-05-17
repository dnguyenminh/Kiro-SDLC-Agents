/** Hybrid search — combines FTS5 (BM25), vector similarity, graph context, and tier boost. */
package com.codeintel.memory.search

import com.codeintel.memory.embedding.EmbeddingService
import com.codeintel.memory.graph.KnowledgeGraph
import com.codeintel.memory.models.KnowledgeSearchResult
import com.codeintel.memory.repository.KnowledgeSearchRepository
import com.codeintel.memory.repository.VectorRepository

/** Search parameters for hybrid search. */
data class SearchParams(
    val query: String,
    val limit: Int = 10,
    val tier: String? = null,
    val type: String? = null,
    val role: String? = null,
    val useVector: Boolean = true,
    val useGraph: Boolean = true,
    val bm25Weight: Double = 0.4,
    val vectorWeight: Double = 0.4,
    val graphWeight: Double = 0.2
)

class HybridSearch(
    private val ftsRepo: KnowledgeSearchRepository,
    private val vectorRepo: VectorRepository,
    private val embeddingService: EmbeddingService?,
    private val graph: KnowledgeGraph?
) {

    /** Execute hybrid search with RRF fusion + tier boost + role filter. */
    fun search(params: SearchParams): List<KnowledgeSearchResult> {
        val ftsResults = searchFts(params)
        val vectorResults = if (params.useVector) searchVector(params) else emptyMap()
        val graphBoost = if (params.useGraph) computeGraphBoost(ftsResults, vectorResults) else emptyMap()
        return fuseResults(ftsResults, vectorResults, graphBoost, params)
    }

    private fun searchFts(params: SearchParams): Map<Long, KnowledgeSearchResult> {
        val results = if (params.tier != null) {
            ftsRepo.searchInTier(params.query, params.tier, params.limit * 2)
        } else {
            ftsRepo.search(params.query, params.limit * 2)
        }
        return results.associateBy { it.entry.id }
    }

    private fun searchVector(params: SearchParams): Map<Long, Double> {
        val queryVec = embeddingService?.embed(params.query) ?: return emptyMap()
        val allVectors = vectorRepo.findAll()
        return allVectors
            .map { it.entryId to EmbeddingService.cosine(queryVec, EmbeddingService.bytesToFloatArray(it.vector)) }
            .sortedByDescending { it.second }
            .take(params.limit * 2)
            .toMap()
    }

    private fun computeGraphBoost(
        ftsResults: Map<Long, KnowledgeSearchResult>,
        vectorResults: Map<Long, Double>
    ): Map<Long, Double> {
        val g = graph ?: return emptyMap()
        val seedIds = (ftsResults.keys + vectorResults.keys).take(5)
        val boosted = mutableMapOf<Long, Double>()
        for (seedId in seedIds) {
            val neighbors = g.getConnected(seedId)
            for (n in neighbors) { boosted[n] = (boosted[n] ?: 0.0) + 1.0 }
        }
        val maxBoost = boosted.values.maxOrNull() ?: 1.0
        return boosted.mapValues { it.value / maxBoost }
    }

    private fun fuseResults(
        ftsResults: Map<Long, KnowledgeSearchResult>,
        vectorScores: Map<Long, Double>,
        graphBoost: Map<Long, Double>,
        params: SearchParams
    ): List<KnowledgeSearchResult> {
        val allIds = ftsResults.keys + vectorScores.keys + graphBoost.keys
        val roleTypes = RoleFilter.typesForRole(params.role)
        val scored = allIds.mapNotNull { id ->
            val entry = ftsResults[id]?.entry ?: return@mapNotNull null
            if (roleTypes != null && entry.type !in roleTypes) return@mapNotNull null
            val ftsScore = rrfScore(ftsResults.keys.indexOf(id)) * params.bm25Weight
            val vecScore = (vectorScores[id] ?: 0.0) * params.vectorWeight
            val gScore = (graphBoost[id] ?: 0.0) * params.graphWeight
            val tierBoost = TierBoost.factor(entry.tier)
            val total = (ftsScore + vecScore + gScore) * tierBoost
            Triple(id, total, entry)
        }
        return scored
            .sortedByDescending { it.second }
            .take(params.limit)
            .map { KnowledgeSearchResult(it.third, it.second, "hybrid") }
    }

    /** Reciprocal Rank Fusion score. */
    private fun rrfScore(rank: Int, k: Int = 60): Double {
        if (rank < 0) return 0.0
        return 1.0 / (k + rank + 1)
    }
}
