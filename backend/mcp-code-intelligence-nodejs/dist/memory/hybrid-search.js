"use strict";
/**
 * HybridSearch — combines FTS5 (BM25) and graph context with RRF fusion.
 * Vector search is optional (requires embedding service).
 * Auto-prepends pinned entries (Core Memory) to search results.
 * Enhanced with: agent scope filter, token budget, working tier expiry.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HybridSearch = void 0;
const role_filter_js_1 = require("./role-filter.js");
const tier_boost_js_1 = require("./tier-boost.js");
class HybridSearch {
    ftsRepo;
    graph;
    coreMemory = null;
    scopeFilter = null;
    tokenBudget = null;
    workingExpiry = null;
    constructor(ftsRepo, graph) {
        this.ftsRepo = ftsRepo;
        this.graph = graph;
    }
    /** Inject CoreMemoryManager for auto-recall. */
    setCoreMemory(cm) {
        this.coreMemory = cm;
    }
    /** Inject AgentScopeFilter for tag-based isolation. */
    setScopeFilter(filter) {
        this.scopeFilter = filter;
    }
    /** Inject TokenBudget for result limiting. */
    setTokenBudget(budget) {
        this.tokenBudget = budget;
    }
    /** Inject WorkingTierExpiry for lazy auto-expiry. */
    setWorkingExpiry(expiry) {
        this.workingExpiry = expiry;
    }
    /** Get pinned context prefix (for prepending to search results). */
    getPinnedContext() {
        if (!this.coreMemory)
            return '';
        return this.coreMemory.getContext();
    }
    /** Enhanced search with scope filter, token budget, and expiry. */
    enhancedSearch(params) {
        // 1. Lazy auto-expiry
        const expiryActions = this.workingExpiry?.processStale() ?? [];
        // 2. Load pinned context
        const pinnedContext = this.getPinnedContext();
        // 3. Execute hybrid search
        let results = this.search(params);
        // 4. Apply agent scope filter
        if (params.agent_scope && this.scopeFilter) {
            results = this.scopeFilter.filter(results, params.agent_scope);
        }
        // 5. Apply token budget
        const maxTokens = params.max_tokens ?? 2000;
        let tokensUsed = 0;
        let truncated = false;
        if (this.tokenBudget) {
            const budgetResult = this.tokenBudget.apply(results, maxTokens);
            results = budgetResult.results;
            tokensUsed = budgetResult.tokensUsed;
            truncated = budgetResult.truncated;
        }
        return {
            pinnedContext,
            results,
            tokens_used: tokensUsed,
            tokens_budget: maxTokens,
            results_truncated: truncated,
            expiry_actions: expiryActions,
        };
    }
    /** Execute hybrid search with RRF fusion. */
    search(params) {
        const ftsResults = this.searchFts(params);
        const graphBoost = this.computeGraphBoost(ftsResults);
        return this.fuseResults(ftsResults, graphBoost, params);
    }
    searchFts(params) {
        if (params.tier) {
            return this.ftsRepo.searchInTier(params.query, params.tier, params.limit * 2);
        }
        return this.ftsRepo.search(params.query, params.limit * 2);
    }
    computeGraphBoost(ftsResults) {
        const seedIds = ftsResults.slice(0, 5).map(r => r.entry.id);
        const boosted = new Map();
        for (const seedId of seedIds) {
            const neighbors = this.graph.getConnected(seedId);
            for (const n of neighbors) {
                boosted.set(n, (boosted.get(n) ?? 0) + 1.0);
            }
        }
        const maxBoost = Math.max(...boosted.values(), 1);
        for (const [k, v] of boosted)
            boosted.set(k, v / maxBoost);
        return boosted;
    }
    fuseResults(ftsResults, graphBoost, params) {
        const ftsMap = new Map(ftsResults.map((r, i) => [r.entry.id, { result: r, rank: i }]));
        const allIds = new Set([...ftsMap.keys(), ...graphBoost.keys()]);
        const roleTypes = (0, role_filter_js_1.typesForRole)(params.role);
        const scored = [];
        for (const id of allIds) {
            const ftsEntry = ftsMap.get(id);
            if (!ftsEntry?.result)
                continue;
            if (roleTypes && !roleTypes.has(ftsEntry.result.entry.type))
                continue;
            const ftsScore = this.rrfScore(ftsEntry.rank) * params.bm25Weight;
            const gScore = (graphBoost.get(id) ?? 0) * params.graphWeight;
            const boost = (0, tier_boost_js_1.tierBoostFactor)(ftsEntry.result.entry.tier);
            const total = (ftsScore + gScore) * boost;
            scored.push({ id, score: total, result: ftsEntry.result });
        }
        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, params.limit)
            .map(s => ({ ...s.result, score: s.score, matchType: 'hybrid' }));
    }
    /** Reciprocal Rank Fusion score. */
    rrfScore(rank, k = 60) {
        return 1.0 / (k + rank + 1);
    }
}
exports.HybridSearch = HybridSearch;
//# sourceMappingURL=hybrid-search.js.map