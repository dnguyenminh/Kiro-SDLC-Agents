/**
 * EmbeddingSearcher — adapter connecting find_tools to ONNX embedding search.
 */
package com.codeintel.orchestration.embedding

import com.codeintel.log
import com.codeintel.orchestration.models.ModelManager
import com.codeintel.orchestration.registry.UnifiedRegistry
import java.io.File

private const val DEFAULT_TIMEOUT_MS = 100L

class EmbeddingSearcher(
    private val modelManager: ModelManager,
    private val registry: UnifiedRegistry
) {
    private var provider: Any? = null
    private val index = ToolEmbeddingIndex()
    private var initialized = false

    /** True if ONNX model is loaded and ready. */
    val isAvailable: Boolean get() {
        if (!initialized) tryInit()
        return provider != null && index.isBuilt
    }

    /** Search tools by embedding similarity. Returns Pair(toolName, score) or null. */
    fun search(query: String, timeoutMs: Long = DEFAULT_TIMEOUT_MS): Pair<String, Float>? {
        if (!isAvailable) return null
        val start = System.nanoTime()
        return try {
            val embedder = provider as? EmbedFunction ?: return null
            val queryVec = embedder.embed(query) ?: return null
            val elapsedMs = (System.nanoTime() - start) / 1_000_000
            if (elapsedMs > timeoutMs) {
                log("[embedding-searcher] Timeout: ${elapsedMs}ms > ${timeoutMs}ms")
                return null
            }
            val results = index.search(queryVec, topK = 1)
            results.firstOrNull()
        } catch (e: Exception) {
            log("[embedding-searcher] Search error: ${e.message}")
            null
        }
    }

    /** Rebuild tool embedding index (after model switch or new tools). */
    fun rebuildIndex() {
        if (provider == null) tryInit()
        val embedder = provider as? EmbedFunction ?: return
        index.build(registry) { text -> embedder.embed(text) }
    }

    private fun tryInit() {
        initialized = true
        try {
            val embedder = createProvider() ?: return
            provider = embedder
            index.build(registry) { text -> embedder.embed(text) }
        } catch (e: Exception) {
            log("[embedding-searcher] Init failed: ${e.message}")
        }
    }

    private fun createProvider(): EmbedFunction? {
        val modelPath = modelManager.getActiveModelPath()
        var modelFile = File("$modelPath/model.onnx")
        var vocabFile = File("$modelPath/vocab.txt")
        if (!modelFile.exists()) {
            val altPath = "${System.getProperty("user.home")}/.code-intel/models"
            modelFile = File("$altPath/model.onnx")
            vocabFile = File("$altPath/vocab.txt")
        }
        if (!modelFile.exists()) return null
        // Try to load ONNX provider via reflection (optional dependency)
        return try {
            val clazz = Class.forName("com.codeintel.memory.embedding.OnnxEmbeddingProvider")
            val ctor = clazz.getConstructor(File::class.java, File::class.java)
            ctor.newInstance(modelFile, vocabFile) as? EmbedFunction
        } catch (e: ClassNotFoundException) {
            log("[embedding-searcher] ONNX runtime not available — embedding disabled")
            null
        }
    }
}

/** Interface for embedding providers. */
interface EmbedFunction {
    fun embed(text: String): FloatArray?
    fun isAvailable(): Boolean
}
