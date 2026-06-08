/** Configuration for ContradictionResolver — all 3 strategies. */
package com.codeintel.memory.contradiction

/**
 * Config controlling which strategies are active.
 * Strategy 2 (LLM) auto-disables if llmEndpoint is null.
 */
data class ContradictionConfig(
    val enableStatusMarking: Boolean = true,
    val enableLlmConsolidation: Boolean = false,
    val enableGraphSupersedes: Boolean = true,
    val entityOverlapThreshold: Double = 0.5,
    val llmEndpoint: String? = null,
    val llmApiKey: String? = null,
    val llmModel: String? = null
) {
    /** LLM is only active when endpoint is configured AND flag is on. */
    val isLlmActive: Boolean get() = enableLlmConsolidation && llmEndpoint != null
}
