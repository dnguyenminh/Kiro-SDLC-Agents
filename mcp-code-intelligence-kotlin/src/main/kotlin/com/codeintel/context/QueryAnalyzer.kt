/** Query Analyzer — extracts keywords, symbol candidates, and phrases from NL queries. KSA-171. */
package com.codeintel.context

import com.codeintel.context.models.QueryAnalysis

class QueryAnalyzer {

    private val stopWords = setOf(
        "how", "does", "the", "is", "what", "where", "when", "a", "an", "in",
        "for", "to", "of", "and", "or", "not", "this", "that", "with", "from",
        "are", "was", "were", "been", "being", "have", "has", "had", "do", "did",
        "will", "would", "could", "should", "may", "might", "can", "shall",
        "its", "it", "they", "them", "their", "we", "our", "you", "your",
        "all", "each", "every", "both", "few", "more", "most", "other", "some",
        "such", "than", "too", "very", "just", "but", "about", "above", "after",
        "before", "between", "into", "through", "during", "until", "while",
    )

    private val symbolPattern = Regex(
        """[A-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)?|[a-z]+(?:_[a-z_]+)+|[a-z]+[A-Z][a-zA-Z0-9]*"""
    )

    /** Analyze a natural language query into search components. */
    fun analyze(query: String): QueryAnalysis {
        val cleaned = query.lowercase().replace(Regex("[^\\w\\s.\\-_]"), " ")
        val tokens = cleaned.split(Regex("\\s+"))
            .filter { it.length > 2 && it !in stopWords }

        val symbolCandidates = symbolPattern.findAll(query).map { it.value }.toList()

        val phrases = (0 until (tokens.size - 1)).map { "${tokens[it]} ${tokens[it + 1]}" }

        val ftsQuery = if (tokens.isNotEmpty()) tokens.joinToString(" OR ") else query

        return QueryAnalysis(
            originalQuery = query,
            keywords = tokens,
            symbolCandidates = symbolCandidates,
            phrases = phrases,
            ftsQuery = ftsQuery,
        )
    }
}
