"use strict";
/**
 * Unit tests for TokenBudget — search result token limiting.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const token_budget_js_1 = require("../v2/token-budget.js");
function makeResult(id, contentLength) {
    const entry = {
        id, content: 'A'.repeat(contentLength), summary: 'test', type: 'CONTEXT',
        tier: 'WORKING', source: null, source_ref: null, tags: '', confidence: 1,
        access_count: 0, created_at: '', updated_at: '', last_accessed_at: null, expires_at: null,
    };
    return { entry, score: 1.0 - id * 0.1, matchType: 'hybrid' };
}
(0, node_test_1.describe)('TokenBudget', () => {
    const budget = new token_budget_js_1.TokenBudget();
    (0, node_test_1.describe)('apply', () => {
        (0, node_test_1.it)('returns all results when within budget', () => {
            const results = [makeResult(1, 100), makeResult(2, 100)]; // 50 tokens total
            const { results: limited, tokensUsed, truncated } = budget.apply(results, 2000);
            strict_1.default.equal(limited.length, 2);
            strict_1.default.equal(tokensUsed, 50); // 200 chars / 4
            strict_1.default.equal(truncated, false);
        });
        (0, node_test_1.it)('limits results when exceeding budget', () => {
            const results = [
                makeResult(1, 4000), // 1000 tokens
                makeResult(2, 4000), // 1000 tokens
                makeResult(3, 4000), // 1000 tokens
            ];
            const { results: limited, truncated, totalMatches } = budget.apply(results, 2000);
            (0, strict_1.default)(limited.length < 3);
            strict_1.default.equal(truncated, true);
            strict_1.default.equal(totalMatches, 3);
        });
        (0, node_test_1.it)('truncates last entry to fit remaining budget', () => {
            const results = [
                makeResult(1, 4000), // 1000 tokens
                makeResult(2, 8000), // 2000 tokens — won't fully fit
            ];
            const { results: limited, tokensUsed } = budget.apply(results, 1500);
            strict_1.default.equal(limited.length, 2);
            (0, strict_1.default)(tokensUsed <= 1510); // small overhead from "..." suffix
            (0, strict_1.default)(limited[1].entry.content.length < 8000);
        });
        (0, node_test_1.it)('skips entry if remaining budget < 50 tokens', () => {
            const results = [
                makeResult(1, 7900), // 1975 tokens
                makeResult(2, 4000), // 1000 tokens — remaining < 50
            ];
            const { results: limited, truncated } = budget.apply(results, 2000);
            strict_1.default.equal(limited.length, 1);
            strict_1.default.equal(truncated, true);
        });
        (0, node_test_1.it)('handles empty results', () => {
            const { results: limited, tokensUsed, truncated } = budget.apply([], 2000);
            strict_1.default.equal(limited.length, 0);
            strict_1.default.equal(tokensUsed, 0);
            strict_1.default.equal(truncated, false);
        });
        (0, node_test_1.it)('handles single result exceeding budget', () => {
            const results = [makeResult(1, 20000)]; // 5000 tokens
            const { results: limited, truncated } = budget.apply(results, 500);
            strict_1.default.equal(limited.length, 1);
            (0, strict_1.default)(limited[0].entry.content.length < 20000);
            strict_1.default.equal(truncated, true);
        });
        (0, node_test_1.it)('preserves result order (highest score first)', () => {
            const results = [makeResult(1, 400), makeResult(2, 400), makeResult(3, 400)];
            const { results: limited } = budget.apply(results, 2000);
            strict_1.default.deepEqual(limited.map(r => r.entry.id), [1, 2, 3]);
        });
    });
});
//# sourceMappingURL=token-budget.test.js.map