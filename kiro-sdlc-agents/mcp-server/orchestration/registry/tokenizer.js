"use strict";
/**
 * Text tokenizer for tool search — splits text into normalized tokens.
 * Handles: underscore_case, camelCase, hyphen-case, spaces.
 * Behavioral parity with Kotlin Tokenizer.kt.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenize = tokenize;
exports.removeStopwords = removeStopwords;
const STOPWORDS = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been',
    'to', 'for', 'and', 'or', 'in', 'on', 'with', 'from', 'by',
    'of', 'at', 'as', 'it', 'its', 'this', 'that', 'not', 'no',
]);
const SPLIT_RE = /[^a-zA-Z0-9]+/;
const CAMEL_RE = /(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/;
/** Tokenize text into normalized, deduplicated, stopword-free tokens. */
function tokenize(text) {
    const rawParts = text.split(SPLIT_RE);
    const camelParts = text.split(CAMEL_RE);
    const allParts = [...rawParts, ...camelParts];
    const result = new Set();
    for (const part of allParts) {
        const t = part.toLowerCase().trim();
        if (t.length > 1 && !STOPWORDS.has(t)) {
            result.add(t);
        }
    }
    return result;
}
/** Remove stopwords from a list of query terms. */
function removeStopwords(terms) {
    return terms.filter((t) => !STOPWORDS.has(t.toLowerCase()));
}
//# sourceMappingURL=tokenizer.js.map