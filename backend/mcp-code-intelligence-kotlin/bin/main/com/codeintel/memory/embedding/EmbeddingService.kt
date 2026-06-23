/** Service layer — coordinates embedding generation and storage. */
package com.codeintel.memory.embedding

import com.codeintel.log
import com.codeintel.memory.repository.VectorRepository
import java.nio.ByteBuffer
import java.nio.ByteOrder

class EmbeddingService(
    private val provider: EmbeddingProvider,
    private val vectorRepo: VectorRepository
) {

    /** Generate and store embedding for a knowledge entry. */
    fun embedAndStore(entryId: Long, text: String): Boolean {
        val vector = provider.embed(text) ?: return false
        val blob = floatArrayToBytes(vector)
        vectorRepo.upsert(entryId, blob, provider.modelName, provider.dimensions)
        return true
    }

    /** Generate embeddings for multiple entries. Returns count of successes. */
    fun embedBatchAndStore(entries: List<Pair<Long, String>>): Int {
        var count = 0
        for ((entryId, text) in entries) {
            if (embedAndStore(entryId, text)) count++
        }
        return count
    }

    /** Compute cosine similarity between a query and stored entry. */
    fun cosineSimilarity(queryVector: FloatArray, entryId: Long): Double {
        val record = vectorRepo.findByEntryId(entryId) ?: return 0.0
        val stored = bytesToFloatArray(record.vector)
        return cosine(queryVector, stored)
    }

    /** Get raw embedding for text (without storing). */
    fun embed(text: String): FloatArray? = provider.embed(text)

    /** Check if embedding provider is available. */
    fun isAvailable(): Boolean = provider.isAvailable()

    /** Release resources. */
    fun close() = provider.close()

    companion object {
        /** Convert FloatArray to ByteArray (little-endian). */
        fun floatArrayToBytes(arr: FloatArray): ByteArray {
            val buf = ByteBuffer.allocate(arr.size * 4).order(ByteOrder.LITTLE_ENDIAN)
            for (f in arr) buf.putFloat(f)
            return buf.array()
        }

        /** Convert ByteArray back to FloatArray. */
        fun bytesToFloatArray(bytes: ByteArray): FloatArray {
            val buf = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
            return FloatArray(bytes.size / 4) { buf.getFloat() }
        }

        /** Cosine similarity between two vectors. */
        fun cosine(a: FloatArray, b: FloatArray): Double {
            if (a.size != b.size) return 0.0
            var dot = 0.0; var normA = 0.0; var normB = 0.0
            for (i in a.indices) {
                dot += a[i] * b[i]
                normA += a[i] * a[i]
                normB += b[i] * b[i]
            }
            val denom = Math.sqrt(normA) * Math.sqrt(normB)
            return if (denom == 0.0) 0.0 else dot / denom
        }
    }
}
