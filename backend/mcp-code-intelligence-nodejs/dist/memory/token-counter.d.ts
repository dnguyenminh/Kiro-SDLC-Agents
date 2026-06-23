/**
 * Token counting utility — approximate token count for budget enforcement.
 * Uses chars/4 heuristic (good enough for ~2000 token budgets).
 */
/** Approximate token count using chars/4 heuristic. */
export declare function countTokens(text: string): number;
/** Check if text fits within a token budget. */
export declare function fitsInBudget(text: string, budget: number): boolean;
/** Truncate text to fit within token budget, preserving whole words. */
export declare function truncateToFit(text: string, budget: number): string;
//# sourceMappingURL=token-counter.d.ts.map