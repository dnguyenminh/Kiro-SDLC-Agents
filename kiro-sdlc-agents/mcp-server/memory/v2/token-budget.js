"use strict";
/**
 * TokenBudget — caps search results to a configurable token limit.
 * Prioritizes higher-ranked results. Truncates individual entries
 * if a single result exceeds remaining budget.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenBudget = void 0;
const token_counter_js_1 = require("../token-counter.js");
class TokenBudget {
    /** Apply token budget to search results. Results must be pre-sorted by score. */
    apply(results, maxTokens) {
        const totalMatches = results.length;
        const limited = [];
        let tokensUsed = 0;
        let truncated = false;
        for (const result of results) {
            const entryTokens = (0, token_counter_js_1.countTokens)(result.entry.content);
            if (tokensUsed + entryTokens <= maxTokens) {
                limited.push(result);
                tokensUsed += entryTokens;
            }
            else {
                const remaining = maxTokens - tokensUsed;
                if (remaining >= 50) {
                    // Truncate this entry to fit remaining budget
                    const truncatedContent = (0, token_counter_js_1.truncateToFit)(result.entry.content, remaining);
                    limited.push({
                        ...result,
                        entry: { ...result.entry, content: truncatedContent },
                    });
                    tokensUsed += (0, token_counter_js_1.countTokens)(truncatedContent);
                }
                truncated = true;
                break;
            }
        }
        return { results: limited, tokensUsed, truncated, totalMatches };
    }
}
exports.TokenBudget = TokenBudget;
//# sourceMappingURL=token-budget.js.map