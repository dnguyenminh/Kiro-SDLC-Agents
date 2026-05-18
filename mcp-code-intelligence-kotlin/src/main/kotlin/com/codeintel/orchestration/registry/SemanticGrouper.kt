/**
 * Builds fallback chains by grouping tools with similar functionality.
 * Two strategies: exact name match + semantic description similarity (Jaccard).
 */
package com.codeintel.orchestration.registry

import com.codeintel.log

class SemanticGrouper(private val threshold: Double = 0.7) {

    /** Build all chains from a list of registered tools. */
    fun buildChains(tools: List<RegisteredTool>): Map<String, ToolChain> {
        val chains = mutableMapOf<String, ToolChain>()
        buildExactNameChains(tools, chains)
        buildSemanticChains(tools, chains)
        return chains
    }

    /** Group tools with identical names on different servers. */
    private fun buildExactNameChains(
        tools: List<RegisteredTool>,
        chains: MutableMap<String, ToolChain>
    ) {
        val grouped = tools.groupBy { it.name }
        for ((name, group) in grouped) {
            if (group.size < 2) continue
            val entries = group
                .map { ChainEntry(it.source.removePrefix("child:"), it.priority, it.name) }
                .sortedBy { it.priority }
            chains[name] = ToolChain(name, entries, "exact_name", emptySet())
        }
    }

    /** Group tools with similar descriptions (different names). */
    private fun buildSemanticChains(
        tools: List<RegisteredTool>,
        chains: MutableMap<String, ToolChain>
    ) {
        val ungrouped = tools.filter { it.name !in chains }
        val paired = mutableSetOf<String>()
        for (i in ungrouped.indices) {
            if (ungrouped[i].name in paired) continue
            findSemanticPair(ungrouped, i, paired, chains)
        }
    }

    private fun findSemanticPair(
        tools: List<RegisteredTool>,
        i: Int,
        paired: MutableSet<String>,
        chains: MutableMap<String, ToolChain>
    ) {
        for (j in i + 1 until tools.size) {
            if (tools[j].name in paired) continue
            val sim = computeSimilarity(tools[i], tools[j])
            if (sim >= threshold) {
                mergeIntoChain(tools[i], tools[j], sim, chains)
                paired.add(tools[i].name)
                paired.add(tools[j].name)
                return
            }
        }
    }

    /** Weighted Jaccard similarity between two tools. */
    fun computeSimilarity(a: RegisteredTool, b: RegisteredTool): Double {
        val tokensA = a.nameTokens + a.descTokens
        val tokensB = b.nameTokens + b.descTokens
        if (tokensA.isEmpty() || tokensB.isEmpty()) return 0.0
        val intersection = tokensA.intersect(tokensB)
        val union = tokensA.union(tokensB)
        val jaccard = intersection.size.toDouble() / union.size.toDouble()
        val nameOverlap = a.nameTokens.intersect(b.nameTokens).size
        return minOf(1.0, jaccard + nameOverlap * 0.1)
    }

    private fun mergeIntoChain(
        a: RegisteredTool, b: RegisteredTool,
        similarity: Double, chains: MutableMap<String, ToolChain>
    ) {
        val canonical = if (a.priority <= b.priority) a else b
        val other = if (a.priority <= b.priority) b else a
        val entries = listOf(
            ChainEntry(canonical.source.removePrefix("child:"), canonical.priority, canonical.name),
            ChainEntry(other.source.removePrefix("child:"), other.priority, other.name)
        ).sortedBy { it.priority }
        val reason = "semantic_similarity:${"%.2f".format(similarity)}"
        val chain = ToolChain(canonical.name, entries, reason, setOf(other.name))
        chains[canonical.name] = chain
        chains[other.name] = chain
        log("[SemanticGrouper] Grouped '${canonical.name}' + '${other.name}' (sim=${"%.2f".format(similarity)})")
    }
}
