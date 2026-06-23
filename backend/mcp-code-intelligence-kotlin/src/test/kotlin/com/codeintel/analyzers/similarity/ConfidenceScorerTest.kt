package com.codeintel.analyzers.similarity

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ConfidenceScorerTest {
    private val scorer = ConfidenceScorer()

    @Test
    fun `no callers only gives 40`() {
        val (score, reasons) = scorer.score("func1", mapOf("no_callers" to true))
        assertEquals(40, score)
        assertTrue(reasons[0].contains("no_callers"))
    }

    @Test
    fun `high confidence combination`() {
        val context = mapOf(
            "no_callers" to true,
            "not_exported" to true,
            "no_tests" to true,
        )
        val (score, _) = scorer.score("func1", context)
        assertEquals(75, score) // 40 + 20 + 15
    }

    @Test
    fun `dynamic dispatch reduces score`() {
        val context = mapOf(
            "no_callers" to true,
            "not_exported" to true,
            "dynamic_dispatch" to true,
        )
        val (score, _) = scorer.score("func1", context)
        assertEquals(30, score) // 40 + 20 - 30
    }

    @Test
    fun `clamp to zero`() {
        val context = mapOf(
            "dynamic_dispatch" to true,
            "config_reference" to true,
            "recently_modified" to true,
        )
        val (score, _) = scorer.score("func1", context)
        assertEquals(0, score) // -30 -20 -10 = -60 clamped to 0
    }
}
