/**
 * HybridSearch — combines FTS5 (BM25) and graph context with RRF fusion.
 * Vector search is optional (requires embedding service).
 * Auto-prepends pinned entries (Core Memory) to search results.
 * Enhanced with: agent scope filter, token budget, working tier expiry.
 */

import { SearchResult } from './models.js';
import { KnowledgeSearchRepository } from './search-repo.js';
import { KnowledgeGraph } from './knowledge-graph.js';
import { typesForRole } from './role-filter.js';
import { tierBoostFactor } from './tier-boost.js';
import type { CoreMemoryManager } from './core-memory.js';
import type { AgentScopeFilter } from './v2/agent-scope-filter.js';
import type { TokenBudget, BudgetResult } from './v2/token-budget.js';
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

export class HybridSearch {
  private readonly ftsRepo: KnowledgeSearchRepository;
  private readonly graph: KnowledgeGraph;
  private coreMemory: CoreMemoryManager | null = null;
  private scopeFilter: AgentScopeFilter | null = null;
  private tokenBudget: TokenBudget | null = null;
  private workingExpiry: WorkingTierExpiry | null = null;

  constructor(ftsRepo: KnowledgeSearchRepository, graph: KnowledgeGraph) {
    this.ftsRepo = ftsRepo;
    this.graph = graph;
  }

  /** Inject CoreMemoryManager for auto-recall. */
  setCoreMemory(cm: CoreMemoryManager): void {
    this.coreMemory = cm;
  }

  /** Inject AgentScopeFilter for tag-based isolation. */
  setScopeFilter(filter: AgentScopeFilter): void {
    this.scopeFilter = filter;
  }

  /** Inject TokenBudget for result limiting. */
  setTokenBudget(budget: TokenBudget): void {
    this.tokenBudget = budget;
  }

  /** Inject WorkingTierExpiry for lazy auto-expiry. */
  setWorkingExpiry(expiry: WorkingTierExpiry): void {
    this.workingExpiry = expiry;
  }

  /** Get pinned context prefix (for prepending to search results). */
  getPinnedContext(): string {
    if (!this.coreMemory) return '';
    return this.coreMemory.getContext();
  }

  /** Enhanced search with scope filter, token budget, and expiry. */
  enhancedSearch(params: EnhancedSearchParams): EnhancedSearchResponse {
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
      const budgetResult: BudgetResult = this.tokenBudget.apply(results, maxTokens);
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
  search(params: SearchParams): SearchResult[] {
    const ftsResults = this.searchFts(params);
    const graphBoost = this.computeGraphBoost(ftsResults);
    return this.fuseResults(ftsResults, graphBoost, params);
  }

  private searchFts(params: SearchParams): SearchResult[] {
    if (params.tier) {
      return this.ftsRepo.searchInTier(params.query, params.tier, params.limit * 2);
    }
    return this.ftsRepo.search(params.query, params.limit * 2);
  }

  private computeGraphBoost(ftsResults: SearchResult[]): Map<number, number> {
    const seedIds = ftsResults.slice(0, 5).map(r => r.entry.id);
    const boosted = new Map<number, number>();
    for (const seedId of seedIds) {
      const neighbors = this.graph.getConnected(seedId);
      for (const n of neighbors) {
        boosted.set(n, (boosted.get(n) ?? 0) + 1.0);
      }
    }
    const maxBoost = Math.max(...boosted.values(), 1);
    for (const [k, v] of boosted) boosted.set(k, v / maxBoost);
    return boosted;
  }

  private fuseResults(
    ftsResults: SearchResult[],
    graphBoost: Map<number, number>,
    params: SearchParams
  ): SearchResult[] {
    const ftsMap = new Map(ftsResults.map((r, i) => [r.entry.id, { result: r, rank: i }]));
    const allIds = new Set([...ftsMap.keys(), ...graphBoost.keys()]);
    const roleTypes = typesForRole(params.role);

    const scored: Array<{ id: number; score: number; result?: SearchResult }> = [];
    for (const id of allIds) {
      const ftsEntry = ftsMap.get(id);
      if (!ftsEntry?.result) continue;
      if (roleTypes && !roleTypes.has(ftsEntry.result.entry.type)) continue;
      const ftsScore = this.rrfScore(ftsEntry.rank) * params.bm25Weight;
      const gScore = (graphBoost.get(id) ?? 0) * params.graphWeight;
      const boost = tierBoostFactor(ftsEntry.result.entry.tier);
      const total = (ftsScore + gScore) * boost;
      scored.push({ id, score: total, result: ftsEntry.result });
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, params.limit)
      .map(s => ({ ...s.result!, score: s.score, matchType: 'hybrid' }));
  }

  /** Reciprocal Rank Fusion score. */
  private rrfScore(rank: number, k = 60): number {
    return 1.0 / (k + rank + 1);
  }
}
