/** Filters for auto-capture — determines what should be captured. */
package com.codeintel.memory.capture

/** Determines if content is worth capturing based on heuristics. */
object CaptureFilter {

    private val DECISION_KEYWORDS = listOf(
        "decided", "chose", "selected", "approach", "architecture",
        "design decision", "trade-off", "alternative"
    )

    private val ERROR_KEYWORDS = listOf(
        "error", "failed", "exception", "bug", "fix", "root cause",
        "workaround", "solution", "resolved"
    )

    /** Check if text contains decision-related content. */
    fun isDecisionContent(text: String): Boolean {
        val lower = text.lowercase()
        return DECISION_KEYWORDS.any { lower.contains(it) }
    }

    /** Check if text contains error pattern content. */
    fun isErrorContent(text: String): Boolean {
        val lower = text.lowercase()
        return ERROR_KEYWORDS.any { lower.contains(it) }
    }

    /** Check if content is substantial enough to capture. */
    fun isSubstantial(text: String, minLength: Int = 50): Boolean {
        return text.trim().length >= minLength
    }

    /** Determine the best knowledge type for content. */
    fun classifyContent(text: String): String {
        return when {
            isDecisionContent(text) -> "DECISION"
            isErrorContent(text) -> "ERROR_PATTERN"
            text.contains("```") -> "PROCEDURE"
            else -> "CONTEXT"
        }
    }
}
