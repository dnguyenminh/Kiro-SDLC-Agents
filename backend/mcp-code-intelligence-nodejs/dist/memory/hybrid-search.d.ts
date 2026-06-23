/**
 * HybridSearch — combines FTS5 (BM25) and graph context with RRF fusion.
 * Vector search is optional (requires embedding service).
 * Auto-prepends pinned entries (Core Memory) to search results.
 * Enhanced with: agent scope filter, token budget, working tier expiry.
 */
import { SearchResult } from './models.js';
import { KnowledgeSearchRepository } from './search-repo.js';
import { KnowledgeGraph } from './knowledge-graph.js';
import type { CoreMemoryManager } from './core-memory.js';
import type { AgentScopeFilter } from './v2/agent-scope-filter.js';
import type { TokenBudget } from './v2/token-budget.js';
import type { WorkingTierExpiry, ExpiryAction } from './v2/working-tier-expiry.js';
export interface SearchParams {
    query: string;
    limit: number;
    tier?: string;
    type?: string;
    role?: string;
    bm25Weight: number;
    graphWeight: number;
}
export interface EnhancedSearchParams extends SearchParams {
    agent_scope?: string;
    max_tokens?: number;
}
export interface EnhancedSearchResponse {
    pinnedContext: string;
    results: SearchResult[];
    tokens_used: number;
    tokens_budget: number;
    results_truncated: boolean;
    expiry_actions: ExpiryAction[];
}
export declare class HybridSearch {
    private readonly ftsRepo;
    private readonly graph;
    private coreMemory;
    private scopeFilter;
    private tokenBudget;
    private workingExpiry;
    constructor(ftsRepo: KnowledgeSearchRepository, graph: KnowledgeGraph);
    /** Inject CoreMemoryManager for auto-recall. */
    setCoreMemory(cm: CoreMemoryManager): void;
    /** Inject AgentScopeFilter for tag-based isolation. */
    setScopeFilter(filter: AgentScopeFilter): void;
    /** Inject TokenBudget for result limiting. */
    setTokenBudget(budget: TokenBudget): void;
    /** Inject WorkingTierExpiry for lazy auto-expiry. */
    setWorkingExpiry(expiry: WorkingTierExpiry): void;
    /** Get pinned context prefix (for prepending to search results). */
    getPinnedContext(): string;
    /** Enhanced search with scope filter, token budget, and expiry. */
    enhancedSearch(params: EnhancedSearchParams): EnhancedSearchResponse;
    /** Execute hybrid search with RRF fusion. */
    search(params: SearchParams): SearchResult[];
    private searchFts;
    private computeGraphBoost;
    private fuseResults;
    /** Reciprocal Rank Fusion score. */
    private rrfScore;
}
//# sourceMappingURL=hybrid-search.d.ts.map