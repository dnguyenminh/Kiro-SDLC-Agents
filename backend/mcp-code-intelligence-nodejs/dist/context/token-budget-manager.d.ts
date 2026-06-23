/**
 * KSA-158/159: Token Budget Manager — estimates tokens and assembles context within budget.
 */
export declare class TokenBudgetManager {
    private budget;
    private consumed;
    constructor(budget: number);
    /** Estimate token count for content (~4 chars per token). */
    estimateTokens(content: any): number;
    /** Check if tokens can fit within remaining budget. */
    canFit(tokens: number): boolean;
    /** Consume tokens from budget. */
    consume(tokens: number): void;
    /** Mark budget as fully consumed. */
    consumeAll(): void;
    /** Get remaining token budget. */
    remaining(): number;
    /** Get total tokens consumed. */
    used(): number;
    /** Check if budget is effectively exhausted (<50 tokens remaining). */
    isExhausted(): boolean;
    /** Truncate content to fit remaining budget. */
    truncateToFit(content: any): any;
    /**
     * Assemble multiple sections into a result within token budget.
     * Sections are sorted by priority (lower = higher priority).
     */
    assemble(sections: Record<string, {
        content: any;
        priority: number;
    }>, budget: number): {
        result: Record<string, any>;
        tokenCount: number;
        included: string[];
        excluded: string[];
    };
    private truncateArray;
}
//# sourceMappingURL=token-budget-manager.d.ts.map