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

/** Enhanced search parameters with agent scope and token budget. */
data class EnhancedSearchParams(
    val query: String,
    val limit: Int = 10,
    val tier: String? = null,
    val type: String? = null,
    val role: String? = null,
    val agentScope: String? = null,
    val maxTokens: Int = 2000
)

/** Enhanced search response with pinned context, budget info, and expiry actions. */
data class EnhancedSearchResponse(
    val pinnedContext: String,
    val results: List<KnowledgeSearchResult>,
    val tokensUsed: Int,
    val tokensBudget: Int,
    val resultsTruncated: Boolean,
    val expiryActions: List<ExpiryAction>
)

class HybridSearch(
    private val ftsRepo: KnowledgeSearchRepository,
    private val vectorRepo: VectorRepository,
    private val embeddingService: EmbeddingService?,
    private val graph: KnowledgeGraph?
) {
    // V2 injectable dependencies (KSA-110 F4)
    private var scopeFilter: AgentScopeFilter? = null
    private var tokenBudget: TokenBudget? = null
    private var workingExpiry: WorkingTierExpiry? = null
    private var pinnedContextProvider: (() -> String)? = null

    /** Inject AgentScopeFilter for tag-based isolation. */
    fun setScopeFilter(filter: AgentScopeFilter) { this.scopeFilter = filter }

    /** Inject TokenBudget for result limiting. */
    fun setTokenBudget(budget: TokenBudget) { this.tokenBudget = budget }

    /** Inject WorkingTierExpiry for lazy auto-expiry. */
    fun setWorkingExpiry(expiry: WorkingTierExpiry) { this.workingExpiry = expiry }

    /** Inject pinned context provider (CoreMemoryManager.getContext). */
    fun setPinnedContextProvider(provider: () -> String) { this.pinnedContextProvider = provider }

    /** Enhanced search: expiry → pins → search → scope → budget. */
    fun enhancedSearch(params: EnhancedSearchParams): EnhancedSearchResponse {
        // 1. Lazy auto-expiry
        val expiryActions = workingExpiry?.processStale() ?: emptyList()

        // 2. Load pinned context
        val pinnedContext = pinnedContextProvider?.invoke() ?: ""

        // 3. Execute hybrid search
        val searchParams = SearchParams(
            query = params.query, limit = params.limit,
            tier = params.tier, type = params.type, role = params.role
        )
        var results = search(searchParams)

        // 4. Apply agent scope filter
        if (params.agentScope != null && scopeFilter != null) {
            results = scopeFilter!!.filter(results, params.agentScope)
        }

        // 5. Apply token budget
        val maxTokens = params.maxTokens
        var tokensUsed = 0
        var truncated = false
        if (tokenBudget != null) {
            val budgetResult = tokenBudget!!.apply(results, maxTokens)
            results = budgetResult.results
            tokensUsed = budgetResult.tokensUsed
            truncated = budgetResult.truncated
        }

        return EnhancedSearchResponse(pinnedContext, results, tokensUsed, maxTokens, truncated, expiryActions)
    }

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
