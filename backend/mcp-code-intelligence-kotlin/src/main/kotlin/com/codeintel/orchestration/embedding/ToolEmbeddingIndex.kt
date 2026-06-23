/**
 * ToolEmbeddingIndex — pre-computed embedding vectors for all registered tools.
 */
package com.codeintel.orchestration.embedding

import com.codeintel.log
import com.codeintel.orchestration.registry.UnifiedRegistry

class ToolEmbeddingIndex {
    private var toolNames: List<String> = emptyList()
    private var vectors: Array<FloatArray> = emptyArray()
    private var built = false

    val isBuilt: Boolean get() = built && vectors.isNotEmpty()
    val toolCount: Int get() = toolNames.size

    /** Build index by embedding all tool descriptions. */
    fun build(registry: UnifiedRegistry, embedFn: (String) -> FloatArray?) {
        val start = System.nanoTime()
        val tools = registry.allChildTools()
        if (tools.isEmpty()) { log("[tool-index] No tools to index"); return }
        val names = mutableListOf<String>()
        val vecs = mutableListOf<FloatArray>()
        for (tool in tools) {
            val desc = tool.definition["description"]?.toString()?.removeSurrounding("\"") ?: ""
            val text = "${tool.name} $desc"
            val vec = embedFn(text)
            if (vec != null) { names.add(tool.name); vecs.add(vec) }
        }
        if (vecs.isEmpty()) { log("[tool-index] No embeddings generated"); return }
        toolNames = names
        vectors = vecs.toTypedArray()
        built = true
        val elapsed = (System.nanoTime() - start) / 1_000_000
        log("[tool-index] Index built: ${names.size} tools in ${elapsed}ms")
    }

    /** Find top-k tools by cosine similarity to query vector. */
    fun search(queryVector: FloatArray, topK: Int = 5): List<Pair<String, Float>> {
        if (!isBuilt) return emptyList()
        val qNorm = vecNorm(queryVector)
        if (qNorm == 0f) return emptyList()
        val q = FloatArray(queryVector.size) { queryVector[it] / qNorm }
        val scores = mutableListOf<Pair<String, Float>>()
        for (i in vectors.indices) {
            val vNorm = vecNorm(vectors[i])
            if (vNorm == 0f) continue
            val sim = dotProduct(q, vectors[i]) / vNorm
            if (sim > 0f) scores.add(toolNames[i] to sim)
        }
        return scores.sortedByDescending { it.second }.take(topK)
    }

    /** Clear the index. */
    fun clear() { toolNames = emptyList(); vectors = emptyArray(); built = false }
}

private fun dotProduct(a: FloatArray, b: FloatArray): Float {
    var sum = 0f
    for (i in a.indices) sum += a[i] * b[i]
    return sum
}

private fun vecNorm(v: FloatArray): Float {
    var sum = 0f
    for (x in v) sum += x * x
    return kotlin.math.sqrt(sum)
}
