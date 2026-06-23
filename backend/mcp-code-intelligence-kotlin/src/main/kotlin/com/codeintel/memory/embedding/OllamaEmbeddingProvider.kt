/** Ollama-backed embedding provider — uses local Ollama for vector generation. */
package com.codeintel.memory.embedding

import com.codeintel.log
import com.codeintel.ollama.OllamaClient

class OllamaEmbeddingProvider(
    private val client: OllamaClient,
    override val modelName: String,
    override val dimensions: Int = 768
) : EmbeddingProvider {

    /** Generate embedding vector for text. */
    override fun embed(text: String): FloatArray? {
        val result = client.embed(text) ?: return null
        return FloatArray(result.size) { result[it].toFloat() }
    }

    /** Batch embed — sequential calls to Ollama. */
    override fun embedBatch(texts: List<String>): List<FloatArray?> {
        return texts.map { embed(it) }
    }

    /** Check if Ollama is reachable. */
    override fun isAvailable(): Boolean = client.isAvailable()

    override fun close() {
        log("OllamaEmbeddingProvider closed")
    }
}
