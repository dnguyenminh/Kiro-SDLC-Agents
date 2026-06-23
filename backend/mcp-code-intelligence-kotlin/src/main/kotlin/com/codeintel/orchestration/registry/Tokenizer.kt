/**
 * Text tokenizer for tool search — splits text into normalized tokens.
 * Handles: underscore_case, camelCase, hyphen-case, spaces.
 */
package com.codeintel.orchestration.registry

object Tokenizer {
    private val STOPWORDS = setOf(
        "a", "an", "the", "is", "are", "was", "were", "be", "been",
        "to", "for", "and", "or", "in", "on", "with", "from", "by",
        "of", "at", "as", "it", "its", "this", "that", "not", "no"
    )

    private val SPLIT_REGEX = Regex("[^a-zA-Z0-9]+")
    private val CAMEL_REGEX = Regex("(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])")

    /** Tokenize text into normalized, deduplicated, stopword-free tokens. */
    fun tokenize(text: String): Set<String> {
        val raw = text.split(SPLIT_REGEX) + text.split(CAMEL_REGEX)
        return raw
            .map { it.lowercase().trim() }
            .filter { it.length > 1 && it !in STOPWORDS }
            .toSet()
    }

    /** Remove stopwords from a list of query terms. */
    fun removeStopwords(terms: List<String>): List<String> =
        terms.filter { it.lowercase() !in STOPWORDS }
}
