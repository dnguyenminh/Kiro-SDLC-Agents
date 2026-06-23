package com.codeintel.parsers.embedding

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ChunkerTest {
    @Test fun `single chunk for short text`() {
        val chunker = Chunker(maxTokens = 10, overlap = 3)
        val result = chunker.chunk("hello world foo bar")
        assertEquals(1, result.size)
        assertEquals(4, result[0].tokenCount)
        assertEquals(0, result[0].index)
    }

    @Test fun `multiple chunks with overlap`() {
        val words = (1..20).joinToString(" ") { "word$it" }
        val chunker = Chunker(maxTokens = 8, overlap = 2)
        val result = chunker.chunk(words)
        assertTrue(result.size > 1)
        assertEquals(0, result[0].index)
        assertEquals(1, result[1].index)
        assertEquals(8, result[0].tokenCount)
    }

    @Test fun `getters work`() {
        val chunker = Chunker(maxTokens = 256, overlap = 64)
        assertEquals(256, chunker.getMaxTokens())
        assertEquals(64, chunker.getOverlap())
    }
}
