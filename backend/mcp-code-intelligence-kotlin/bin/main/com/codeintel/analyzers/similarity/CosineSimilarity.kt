/** Cosine similarity and vector utility functions. */
package com.codeintel.analyzers.similarity

import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.sqrt

/** Compute cosine similarity between two float arrays. */
fun cosineSimilarity(a: FloatArray, b: FloatArray): Double {
    if (a.size != b.size) return 0.0
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

/** Convert little-endian byte array to FloatArray. */
fun bytesToFloats(data: ByteArray): FloatArray {
    val count = data.size / 4
    val buf = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN)
    return FloatArray(count) { buf.getFloat() }
}

/** Convert FloatArray to little-endian byte array. */
fun floatsToBytes(arr: FloatArray): ByteArray {
    val buf = ByteBuffer.allocate(arr.size * 4).order(ByteOrder.LITTLE_ENDIAN)
    for (f in arr) buf.putFloat(f)
    return buf.array()
}
