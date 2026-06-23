/** Generate refactoring suggestions for duplicate clusters. */
package com.codeintel.analyzers.similarity

import com.codeintel.analyzers.similarity.models.Cluster
import com.codeintel.analyzers.similarity.models.RefactoringSuggestion
import com.codeintel.analyzers.similarity.models.SymbolInfo

/** Generate actionable refactoring suggestions from duplicate clusters. */
class SuggestionGenerator {

    /** Generate suggestions for each cluster. */
    fun generate(
        clusters: List<Cluster>,
        symbolInfo: Map<String, SymbolInfo>
    ): List<RefactoringSuggestion> {
        return clusters.mapNotNull { suggestForCluster(it, symbolInfo) }
    }

    private fun suggestForCluster(
        cluster: Cluster,
        symbolInfo: Map<String, SymbolInfo>
    ): RefactoringSuggestion? {
        val members = cluster.members
        if (members.size < 2) return null

        val infos = members.map { symbolInfo[it] }
        val sameFile = infos.mapNotNull { it?.file }.toSet().size == 1
        val kinds = infos.mapNotNull { it?.kind }.toSet()
        val avgLines = computeAvgLines(infos)

        val (type, desc) = determineSuggestion(members, sameFile, kinds)
        val linesSaved = maxOf(0, (members.size - 1) * avgLines)

        return RefactoringSuggestion(
            clusterId = cluster.representative,
            suggestionType = type,
            description = desc,
            members = members,
            estimatedLinesSaved = linesSaved,
        )
    }

    private fun determineSuggestion(
        members: List<String>,
        sameFile: Boolean,
        kinds: Set<String>
    ): Pair<String, String> {
        return when {
            "method" in kinds && !sameFile -> "extract_base_class" to
                "Extract common logic from ${members.size} similar methods into a shared base class or mixin."
            sameFile -> "extract_function" to
                "Extract ${members.size} near-duplicate functions in the same file into a single parameterized function."
            else -> "extract_function" to
                "Extract common logic from ${members.size} similar functions into a shared utility function."
        }
    }

    private fun computeAvgLines(infos: List<SymbolInfo?>): Int {
        val counts = infos.mapNotNull { info ->
            info?.let { it.endLine - it.startLine }
                ?.takeIf { it > 0 }
        }
        return if (counts.isEmpty()) 10 else counts.average().toInt()
    }
}
