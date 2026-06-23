/**
 * KSA-169: Chunker — Split text into overlapping chunks for embedding.
 */
package com.codeintel.parsers.embedding

data class Chunk(
    val text: String,
    val index: Int,
    val tokenCount: Int,
    val startOffset: Int,
    val endOffset: Int,
)

class Chunker(
    private val maxTokens: Int = 512,
    private val overlap: Int = 128,
) {
    fun chunk(text: String): List<Chunk> {
        val words = text.split(Regex("\\s+")).filter { it.isNotEmpty() }
        if (words.size <= maxTokens) {
            return listOf(Chunk(text, 0, words.size, 0, text.length))
        }
        val chunks = mutableListOf<Chunk>()
        var start = 0
        var chunkIndex = 0
        while (start < words.size) {
            val end = minOf(start + maxTokens, words.size)
            val chunkWords = words.subList(start, end)
            chunks.add(Chunk(
                text = chunkWords.joinToString(" "),
                index = chunkIndex,
                tokenCount = chunkWords.size,
                startOffset = start,
                endOffset = end,
            ))
            chunkIndex++
            start += maxTokens - overlap
            if (start >= words.size) break
        }
        return chunks
    }

    fun getMaxTokens(): Int = maxTokens
    fun getOverlap(): Int = overlap
}
