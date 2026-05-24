"use strict";
/**
 * Token counting utility — approximate token count for budget enforcement.
 * Uses chars/4 heuristic (good enough for ~2000 token budgets).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.countTokens = countTokens;
exports.fitsInBudget = fitsInBudget;
exports.truncateToFit = truncateToFit;
/** Approximate token count using chars/4 heuristic. */
function countTokens(text) {
    if (!text)
        return 0;
    return Math.ceil(text.length / 4);
}
/** Check if text fits within a token budget. */
function fitsInBudget(text, budget) {
    return countTokens(text) <= budget;
}
/** Truncate text to fit within token budget, preserving whole words. */
function truncateToFit(text, budget) {
    if (fitsInBudget(text, budget))
        return text;
    const charLimit = budget * 4;
    const truncated = text.slice(0, charLimit);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 0 ? truncated.slice(0, lastSpace) + '...' : truncated + '...';
}
//# sourceMappingURL=token-counter.js.map