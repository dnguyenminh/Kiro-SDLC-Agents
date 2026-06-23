/** Score dead code confidence based on multiple heuristic factors. */
package com.codeintel.analyzers.similarity

/**
 * Score dead code confidence based on multiple factors.
 * Higher score = more likely to be truly dead code.
 * Negative factors reduce confidence (e.g., dynamic dispatch patterns).
 */
class ConfidenceScorer {

    companion object {
        val FACTORS: Map<String, Int> = mapOf(
            "no_callers" to 40,
            "not_exported" to 20,
            "no_tests" to 15,
            "has_deprecated" to 15,
            "dynamic_dispatch" to -30,
            "config_reference" to -20,
            "recently_modified" to -10,
        )
    }

    /**
     * Compute confidence score (0-100) and list of contributing reasons.
     * @param functionId Unique identifier for the function.
     * @param context Dict with keys matching FACTORS (bool values).
     * @return Pair of (score, reasons).
     */
    fun score(functionId: String, context: Map<String, Boolean>): Pair<Int, List<String>> {
        var score = 0
        val reasons = mutableListOf<String>()

        for ((factor, impact) in FACTORS) {
            if (context[factor] == true) {
                score += impact
                val sign = if (impact > 0) "+" else ""
                reasons.add("$factor ($sign$impact)")
            }
        }

        val finalScore = score.coerceIn(0, 100)
        return finalScore to reasons
    }
}
