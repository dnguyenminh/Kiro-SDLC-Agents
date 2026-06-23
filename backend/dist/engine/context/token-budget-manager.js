/**
 * KSA-158/159: Token Budget Manager — estimates tokens and assembles context within budget.
 */
export class TokenBudgetManager {
    budget;
    consumed = 0;
    constructor(budget) {
        this.budget = Math.max(budget, 500); // Minimum 500 tokens
    }
    /** Estimate token count for content (~4 chars per token). */
    estimateTokens(content) {
        const text = typeof content === 'string' ? content : JSON.stringify(content);
        return Math.ceil(text.length / 4);
    }
    /** Check if tokens can fit within remaining budget. */
    canFit(tokens) {
        return this.consumed + tokens <= this.budget;
    }
    /** Consume tokens from budget. */
    consume(tokens) {
        this.consumed += tokens;
    }
    /** Mark budget as fully consumed. */
    consumeAll() {
        this.consumed = this.budget;
    }
    /** Get remaining token budget. */
    remaining() {
        return Math.max(0, this.budget - this.consumed);
    }
    /** Get total tokens consumed. */
    used() {
        return this.consumed;
    }
    /** Check if budget is effectively exhausted (<50 tokens remaining). */
    isExhausted() {
        return this.remaining() < 50;
    }
    /** Truncate content to fit remaining budget. */
    truncateToFit(content) {
        const maxChars = this.remaining() * 4;
        if (typeof content === 'string') {
            if (content.length <= maxChars)
                return content;
            return content.substring(0, maxChars) + '\n... (truncated)';
        }
        if (Array.isArray(content)) {
            let chars = 0;
            const result = [];
            for (const item of content) {
                const itemStr = JSON.stringify(item);
                if (chars + itemStr.length > maxChars)
                    break;
                result.push(item);
                chars += itemStr.length;
            }
            return result;
        }
        const text = JSON.stringify(content);
        if (text.length <= maxChars)
            return content;
        return text.substring(0, maxChars);
    }
    /**
     * Assemble multiple sections into a result within token budget.
     * Sections are sorted by priority (lower = higher priority).
     */
    assemble(sections, budget) {
        const sorted = Object.entries(sections)
            .filter(([_, v]) => v.content != null)
            .sort(([_, a], [__, b]) => a.priority - b.priority);
        const result = {};
        let usedTokens = 0;
        const included = [];
        const excluded = [];
        for (const [key, { content }] of sorted) {
            const tokens = this.estimateTokens(content);
            if (usedTokens + tokens <= budget) {
                result[key] = content;
                usedTokens += tokens;
                included.push(key);
            }
            else if (Array.isArray(content) && content.length > 0) {
                // Try truncation for arrays
                const remaining = budget - usedTokens;
                const truncated = this.truncateArray(content, remaining);
                if (truncated.length > 0) {
                    result[key] = truncated;
                    usedTokens += this.estimateTokens(truncated);
                    included.push(`${key} (truncated: ${truncated.length}/${content.length})`);
                    continue;
                }
                excluded.push(key);
            }
            else {
                excluded.push(key);
            }
        }
        return { result, tokenCount: usedTokens, included, excluded };
    }
    truncateArray(arr, tokenBudget) {
        const result = [];
        let used = 0;
        for (const item of arr) {
            const tokens = this.estimateTokens(item);
            if (used + tokens > tokenBudget)
                break;
            result.push(item);
            used += tokens;
        }
        return result;
    }
}
//# sourceMappingURL=token-budget-manager.js.map