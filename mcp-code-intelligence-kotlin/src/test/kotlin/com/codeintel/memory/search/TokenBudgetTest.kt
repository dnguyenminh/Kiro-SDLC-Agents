/** Unit tests for TokenBudget — search result token limiting. */
package com.codeintel.memory.search

import com.codeintel.memory.models.KnowledgeEntry
import com.codeintel.memory.models.KnowledgeSearchResult
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class TokenBudgetTest {

    private fun makeResult(content: String, id: Long = 1): KnowledgeSearchResult {
        return KnowledgeSearchResult(
            entry = KnowledgeEntry(id = id, content = content, summary = "s", type = "CONTEXT"),
            score = 1.0
        )
    }

    @Test
    fun `returns all results when within budget`() {
        val budget = TokenBudget()
        val results = listOf(
            makeResult("short content", 1),
            makeResult("another short", 2),
        )
        val br = budget.apply(results, 2000)
        assertEquals(2, br.results.size)
        assertFalse(br.truncated)
        assertEquals(2, br.totalMatches)
    }

    @Test
    fun `truncates when budget exceeded`() {
        val budget = TokenBudget()
        val longContent = "x".repeat(4000) // ~1000 tokens
        val results = listOf(
            makeResult(longContent, 1),
            makeResult(longContent, 2),
            makeResult(longContent, 3),
        )
        val br = budget.apply(results, 1500)
        assertTrue(br.results.size < 3)
        assertTrue(br.truncated)
        assertEquals(3, br.totalMatches)
        assertTrue(br.tokensUsed <= 1500)
    }

    @Test
    fun `truncates individual entry to fit remaining budget`() {
        val budget = TokenBudget()
        val results = listOf(
            makeResult("a".repeat(400), 1),  // 100 tokens
            makeResult("b".repeat(4000), 2), // 1000 tokens — won't fit in remaining
        )
        val br = budget.apply(results, 300)
        assertEquals(2, br.results.size)
        assertTrue(br.truncated)
        // Second result should be truncated
        assertTrue(br.results[1].entry.content.length < 4000)
        assertTrue(br.results[1].entry.content.endsWith("..."))
    }

    @Test
    fun `skips entry if remaining budget too small`() {
        val budget = TokenBudget()
        val results = listOf(
            makeResult("a".repeat(1000), 1), // 250 tokens
            makeResult("b".repeat(4000), 2), // 1000 tokens
        )
        // Budget = 260 → first fits (250), remaining = 10 < 50 → skip second
        val br = budget.apply(results, 260)
        assertEquals(1, br.results.size)
        assertTrue(br.truncated)
    }

    @Test
    fun `empty results returns empty`() {
        val budget = TokenBudget()
        val br = budget.apply(emptyList(), 2000)
        assertEquals(0, br.results.size)
        assertFalse(br.truncated)
        assertEquals(0, br.tokensUsed)
    }

    @Test
    fun `countTokens approximation works`() {
        assertEquals(1, countTokens("abcd"))    // 4 chars = 1 token
        assertEquals(2, countTokens("abcde"))   // 5 chars ≈ 2 tokens
        assertEquals(25, countTokens("x".repeat(100))) // 100 chars = 25 tokens
    }

    @Test
    fun `truncateToFit respects token limit`() {
        val text = "x".repeat(1000)
        val truncated = truncateToFit(text, 50) // 50 tokens = 200 chars
        assertTrue(truncated.length <= 200)
        assertTrue(truncated.endsWith("..."))
    }

    @Test
    fun `truncateToFit returns original if within limit`() {
        val text = "short text"
        val result = truncateToFit(text, 100)
        assertEquals(text, result)
    }
}
