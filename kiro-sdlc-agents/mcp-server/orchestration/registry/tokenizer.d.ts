/**
 * Text tokenizer for tool search — splits text into normalized tokens.
 * Handles: underscore_case, camelCase, hyphen-case, spaces.
 * Behavioral parity with Kotlin Tokenizer.kt.
 */
/** Tokenize text into normalized, deduplicated, stopword-free tokens. */
export declare function tokenize(text: string): Set<string>;
/** Remove stopwords from a list of query terms. */
export declare function removeStopwords(terms: string[]): string[];
//# sourceMappingURL=tokenizer.d.ts.map