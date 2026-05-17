/**
 * HybridSearch — combines FTS5 (BM25) and graph context with RRF fusion.
 * Vector search is optional (requires embedding service).
 */

import { SearchResult } from './models.js';
import { KnowledgeSearchRepository } from './search-repo.js';
import { KnowledgeGraph } from './knowledge-graph.js';

export interface SearchParams {
  query: string;
  limit: number;
  tier?: string;
  type?: string;
  bm25Weight: number;
  graphWeight: number;
}

export class HybridSearch {
  private readonly ftsRepo: KnowledgeSearchRepository;
  private readonly graph: KnowledgeGraph;

  constructor(ftsRepo: KnowledgeSearchRepository, graph: KnowledgeGraph) {
    this.ftsRepo = ftsRepo;
    this.graph = graph;
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

    const scored: Array<{ id: number; score: number; result?: SearchResult }> = [];
    for (const id of allIds) {
      const ftsEntry = ftsMap.get(id);
      const ftsScore = ftsEntry ? this.rrfScore(ftsEntry.rank) * params.bm25Weight : 0;
      const gScore = (graphBoost.get(id) ?? 0) * params.graphWeight;
      const total = ftsScore + gScore;
      scored.push({ id, score: total, result: ftsEntry?.result });
    }

    return scored
      .filter(s => s.result !== undefined)
      .sort((a, b) => b.score - a.score)
      .slice(0, params.limit)
      .map(s => ({ ...s.result!, score: s.score, matchType: 'hybrid' }));
  }

  /** Reciprocal Rank Fusion score. */
  private rrfScore(rank: number, k = 60): number {
    return 1.0 / (k + rank + 1);
  }
}
