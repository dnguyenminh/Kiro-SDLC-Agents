/** Zero-context chunking strategies for document ingestion. */
package com.codeintel.memory.ingest

/** A chunk of text with metadata about its position. */
data class TextChunk(
    val content: String,
    val index: Int,
    val startOffset: Int,
    val endOffset: Int,
    val metadata: Map<String, String> = emptyMap()
)

/** Interface for chunking strategies. */
interface ChunkingStrategy {
    fun chunk(text: String, metadata: Map<String, String> = emptyMap()): List<TextChunk>
}

/** Fixed-size chunking with overlap. */
class FixedSizeChunker(
    private val chunkSize: Int = 512,
    private val overlap: Int = 64
) : ChunkingStrategy {

    override fun chunk(text: String, metadata: Map<String, String>): List<TextChunk> {
        if (text.length <= chunkSize) {
            return listOf(TextChunk(text, 0, 0, text.length, metadata))
        }
        val chunks = mutableListOf<TextChunk>()
        var start = 0
        var index = 0
        while (start < text.length) {
            val end = minOf(start + chunkSize, text.length)
            val content = text.substring(start, end)
            chunks.add(TextChunk(content, index, start, end, metadata))
            start += chunkSize - overlap
            index++
        }
        return chunks
    }
}

/** Semantic chunking — splits on paragraph/section boundaries. */
class SemanticChunker(
    private val maxChunkSize: Int = 1024,
    private val minChunkSize: Int = 100
) : ChunkingStrategy {

    override fun chunk(text: String, metadata: Map<String, String>): List<TextChunk> {
        val paragraphs = splitParagraphs(text)
        return mergeParagraphs(paragraphs, metadata)
    }

    private fun splitParagraphs(text: String): List<String> {
        return text.split(Regex("\n{2,}")).filter { it.isNotBlank() }
    }

    private fun mergeParagraphs(
        paragraphs: List<String>,
        metadata: Map<String, String>
    ): List<TextChunk> {
        val chunks = mutableListOf<TextChunk>()
        val current = StringBuilder()
        var offset = 0
        var index = 0

        for (para in paragraphs) {
            if (current.length + para.length > maxChunkSize && current.isNotEmpty()) {
                chunks.add(TextChunk(current.toString().trim(), index, offset, offset + current.length, metadata))
                offset += current.length
                current.clear()
                index++
            }
            current.appendLine(para)
        }
        if (current.isNotBlank()) {
            chunks.add(TextChunk(current.toString().trim(), index, offset, offset + current.length, metadata))
        }
        return chunks
    }
}
