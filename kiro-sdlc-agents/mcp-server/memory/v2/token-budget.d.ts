/**
 * TokenBudget — caps search results to a configurable token limit.
 * Prioritizes higher-ranked results. Truncates individual entries
 * if a single result exceeds remaining budget.
 */
import { SearchResult } from '../models.js';
export interface BudgetResult {
    results: SearchResult[];
    tokensUsed: number;
    truncated: boolean;
    totalMatches: number;
}
export declare class TokenBudget {
    /** Apply token budget to search results. Results must be pre-sorted by score. */
    apply(results: SearchResult[], maxTokens: number): BudgetResult;
}
//# sourceMappingURL=token-budget.d.ts.map