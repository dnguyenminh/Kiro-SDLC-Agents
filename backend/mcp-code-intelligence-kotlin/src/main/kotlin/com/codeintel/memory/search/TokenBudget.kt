/**
 * TokenBudget — caps search results to a configurable token limit.
 * Prioritizes higher-ranked results. Truncates individual entries
 * if a single result exceeds remaining budget.
 * Token counting uses chars/4 approximation (no tiktoken dependency).
 */
package com.codeintel.memory.search

import com.codeintel.memory.models.KnowledgeSearchResult

/** Result of applying token budget to search results. */
data class BudgetResult(
    val results: List<KnowledgeSearchResult>,
    val tokensUsed: Int,
    val truncated: Boolean,
    val totalMatches: Int
)

class TokenBudget {

    /** Apply token budget to search results. Results must be pre-sorted by score. */
    fun apply(results: List<KnowledgeSearchResult>, maxTokens: Int): BudgetResult {
        val totalMatches = results.size
        val limited = mutableListOf<KnowledgeSearchResult>()
        var tokensUsed = 0
        var truncated = false

        for (result in results) {
            val entryTokens = countTokens(result.entry.content)
            if (tokensUsed + entryTokens <= maxTokens) {
                limited.add(result)
                tokensUsed += entryTokens
            } else {
                val remaining = maxTokens - tokensUsed
                if (remaining >= 50) {
                    val truncatedContent = truncateToFit(result.entry.content, remaining)
                    limited.add(result.copy(entry = result.entry.copy(content = truncatedContent)))
                    tokensUsed += countTokens(truncatedContent)
                }
                truncated = true
                break
            }
        }
        return BudgetResult(limited, tokensUsed, truncated, totalMatches)
    }
}

/** Approximate token count (chars / 4). */
fun countTokens(text: String): Int = (text.length + 3) / 4

/** Truncate text to fit within token budget. */
fun truncateToFit(text: String, maxTokens: Int): String {
    val maxChars = maxTokens * 4
    if (text.length <= maxChars) return text
    return text.take(maxChars - 3) + "..."
}
