package com.codeintel.analyzers.similarity

import kotlin.test.Test
import kotlin.test.assertEquals

class CosineSimilarityTest {

    @Test
    fun `identical vectors`() {
        val v = floatArrayOf(1f, 0f, 0f)
        assertEquals(1.0, cosineSimilarity(v, v), 0.0001)
    }

    @Test
    fun `orthogonal vectors`() {
        val a = floatArrayOf(1f, 0f, 0f)
        val b = floatArrayOf(0f, 1f, 0f)
        assertEquals(0.0, cosineSimilarity(a, b), 0.0001)
    }

    @Test
    fun `opposite vectors`() {
        val a = floatArrayOf(1f, 0f)
        val b = floatArrayOf(-1f, 0f)
        assertEquals(-1.0, cosineSimilarity(a, b), 0.0001)
    }

    @Test
    fun `different lengths returns zero`() {
        val a = floatArrayOf(1f, 0f)
        val b = floatArrayOf(1f, 0f, 0f)
        assertEquals(0.0, cosineSimilarity(a, b), 0.0001)
    }

    @Test
    fun `bytes round trip`() {
        val original = floatArrayOf(0.5f, 1.0f, -0.3f, 0.0f)
        val bytes = floatsToBytes(original)
        val restored = bytesToFloats(bytes)
        for (i in original.indices) {
            assertEquals(original[i], restored[i], 0.0001f)
        }
    }
}
