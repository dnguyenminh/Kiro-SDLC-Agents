/** Semantic linking via vector cosine similarity. KSA-190. */
package com.codeintel.memory.ingest.autolink

import com.codeintel.memory.repository.VectorRepository
import kotlin.math.sqrt

class SemanticStrategy(
    private val vectorRepo: VectorRepository
) : LinkingStrategy {

    override val name = "semantic"

    override fun isEnabled(config: AutoLinkConfig): Boolean =
        config.semantic.enabled

    override fun findCandidates(entryId: Long, config: AutoLinkConfig): List<CandidateEdge> {
        val myRecord = vectorRepo.findByEntryId(entryId) ?: return emptyList()
        val myVector = bytesToFloats(myRecord.vector)
        val allVectors = vectorRepo.findAll()

        return allVectors
            .filter { it.entryId != entryId }
            .mapNotNull { record ->
                val other = bytesToFloats(record.vector)
                val score = cosineSimilarity(myVector, other)
                if (score >= config.semantic.minScore) {
                    CandidateEdge(
                        targetId = record.entryId,
                        relation = AutoLinkRelations.SIMILAR_TO,
                        score = score,
                        metadata = mapOf("method" to "cosine", "model" to record.model)
                    )
                } else null
            }
            .sortedByDescending { it.score }
            .take(config.semantic.maxEdges)
    }

    companion object {
        /** Convert byte array (little-endian float32) to FloatArray. */
        fun bytesToFloats(bytes: ByteArray): FloatArray {
            val count = bytes.size / 4
            val floats = FloatArray(count)
            for (i in 0 until count) {
                val offset = i * 4
                val bits = (bytes[offset].toInt() and 0xFF) or
                    ((bytes[offset + 1].toInt() and 0xFF) shl 8) or
                    ((bytes[offset + 2].toInt() and 0xFF) shl 16) or
                    ((bytes[offset + 3].toInt() and 0xFF) shl 24)
                floats[i] = Float.fromBits(bits)
            }
            return floats
        }

        /** Cosine similarity between two vectors. */
        fun cosineSimilarity(a: FloatArray, b: FloatArray): Double {
            if (a.size != b.size || a.isEmpty()) return 0.0
            var dot = 0.0
            var normA = 0.0
            var normB = 0.0
            for (i in a.indices) {
                dot += a[i] * b[i]
                normA += a[i] * a[i]
                normB += b[i] * b[i]
            }
            val denom = sqrt(normA) * sqrt(normB)
            return if (denom == 0.0) 0.0 else dot / denom
        }
    }
}
