/** Interface for embedding providers — abstracts ONNX vs Ollama. */
package com.codeintel.memory.embedding

/** Contract for text-to-vector embedding. */
interface EmbeddingProvider {
    /** Model name identifier. */
    val modelName: String

    /** Output vector dimensions. */
    val dimensions: Int

    /** Generate embedding vector for text. Returns null on failure. */
    fun embed(text: String): FloatArray?

    /** Generate embeddings for multiple texts (batch). */
    fun embedBatch(texts: List<String>): List<FloatArray?>

    /** Check if provider is ready. */
    fun isAvailable(): Boolean

    /** Release resources. */
    fun close()
}
