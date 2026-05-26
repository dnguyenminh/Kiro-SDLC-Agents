/** RRF Merger — Reciprocal Rank Fusion for merging multi-source results. KSA-171. */
package com.codeintel.context

import com.codeintel.context.models.MergedResult
import com.codeintel.context.models.SourceWeights

class RRFMerger(private val k: Int = 60) {

    /** Merge results from multiple sources using Reciprocal Rank Fusion. */
    fun merge(
        sources: Map<String, List<Map<String, Any?>>>,
        weights: SourceWeights?,
    ): List<MergedResult> {
        val w = weights ?: SourceWeights()
        val scores = mutableMapOf<String, Triple<Double, Map<String, Any?>, MutableList<String>>>()

        addScores(scores, sources["code"] ?: emptyList(), w.code, "code")
        addScores(scores, sources["memory"] ?: emptyList(), w.memory, "memory")
        addScores(scores, sources["graph"] ?: emptyList(), w.graph, "graph")

        return scores.values
            .sortedByDescending { it.first }
            .map { (score, item, srcs) ->
                MergedResult(
                    name = item["name"]?.toString() ?: "",
                    id = (item["id"] as? Number)?.toInt(),
                    kind = item["kind"]?.toString(),
                    file = item["file"]?.toString(),
                    line = (item["line"] as? Number)?.toInt(),
                    signature = item["signature"]?.toString(),
                    sourceCode = item["source_code"]?.toString(),
                    content = item["content"]?.toString(),
                    relevanceScore = score,
                    sources = srcs.toList(),
                    relationship = item["relationship"]?.toString(),
                )
            }
    }

    private fun addScores(
        scores: MutableMap<String, Triple<Double, Map<String, Any?>, MutableList<String>>>,
        results: List<Map<String, Any?>>,
        weight: Double,
        source: String,
    ) {
        for ((rank, item) in results.withIndex()) {
            val key = getKey(item)
            val rrfScore = weight * (1.0 / (k + rank))

            val existing = scores[key]
            if (existing != null) {
                scores[key] = Triple(existing.first + rrfScore, existing.second, existing.third.also { it.add(source) })
            } else {
                scores[key] = Triple(rrfScore, item, mutableListOf(source))
            }
        }
    }

    private fun getKey(item: Map<String, Any?>): String {
        item["id"]?.let { return it.toString() }
        val name = item["name"]?.toString() ?: ""
        val file = item["file"]?.toString() ?: ""
        if (name.isNotEmpty() && file.isNotEmpty()) return "$name:$file"
        if (name.isNotEmpty()) return name
        return item.toString().take(100)
    }
}
