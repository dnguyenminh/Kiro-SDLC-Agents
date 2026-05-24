"use strict";
/**
 * Unit tests for token-counter utility.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const token_counter_js_1 = require("../token-counter.js");
(0, node_test_1.describe)('countTokens', () => {
    (0, node_test_1.it)('should return 0 for empty string', () => {
        strict_1.default.equal((0, token_counter_js_1.countTokens)(''), 0);
    });
    (0, node_test_1.it)('should approximate tokens as chars/4', () => {
        strict_1.default.equal((0, token_counter_js_1.countTokens)('abcd'), 1);
        strict_1.default.equal((0, token_counter_js_1.countTokens)('abcdefgh'), 2);
        strict_1.default.equal((0, token_counter_js_1.countTokens)('a'.repeat(100)), 25);
    });
    (0, node_test_1.it)('should ceil fractional tokens', () => {
        strict_1.default.equal((0, token_counter_js_1.countTokens)('abc'), 1); // 3/4 = 0.75 → ceil = 1
        strict_1.default.equal((0, token_counter_js_1.countTokens)('abcde'), 2); // 5/4 = 1.25 → ceil = 2
    });
});
(0, node_test_1.describe)('fitsInBudget', () => {
    (0, node_test_1.it)('should return true when within budget', () => {
        strict_1.default.equal((0, token_counter_js_1.fitsInBudget)('hello', 10), true);
    });
    (0, node_test_1.it)('should return false when over budget', () => {
        strict_1.default.equal((0, token_counter_js_1.fitsInBudget)('a'.repeat(100), 10), false);
    });
});
(0, node_test_1.describe)('truncateToFit', () => {
    (0, node_test_1.it)('should return original if within budget', () => {
        strict_1.default.equal((0, token_counter_js_1.truncateToFit)('hello world', 100), 'hello world');
    });
    (0, node_test_1.it)('should truncate at word boundary', () => {
        const text = 'hello world this is a test';
        const result = (0, token_counter_js_1.truncateToFit)(text, 3); // 12 chars max
        (0, strict_1.default)(result.length <= 16); // 12 + "..."
        (0, strict_1.default)(result.endsWith('...'));
    });
});
//# sourceMappingURL=token-counter.test.js.map