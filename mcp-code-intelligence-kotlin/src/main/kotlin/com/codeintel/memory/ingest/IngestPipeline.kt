/** Document ingestion pipeline — parse, chunk, embed, store. */
package com.codeintel.memory.ingest

import com.codeintel.log
import com.codeintel.memory.embedding.EmbeddingService
import com.codeintel.memory.models.KnowledgeEntry
import com.codeintel.memory.models.KnowledgeType
import com.codeintel.memory.models.MemoryTier
import com.codeintel.memory.repository.KnowledgeRepository

/** Result of ingesting a document. */
data class IngestResult(
    val entriesCreated: Int,
    val embeddingsGenerated: Int,
    val source: String,
    val entryIds: List<Long> = emptyList()
)

class IngestPipeline(
    private val knowledgeRepo: KnowledgeRepository,
    private val embeddingService: EmbeddingService?,
    private val chunker: ChunkingStrategy = SemanticChunker()
) {

    /** Ingest a markdown document. */
    fun ingestMarkdown(text: String, source: String, type: String = KnowledgeType.CONTEXT.name): IngestResult {
        val doc = DocumentParser.parseMarkdown(text, source)
        return ingestParsedDocument(doc, type)
    }

    /** Ingest plain text. */
    fun ingestText(text: String, source: String, type: String = KnowledgeType.CONTEXT.name): IngestResult {
        val doc = DocumentParser.parsePlainText(text, source)
        return ingestParsedDocument(doc, type)
    }

    /** Ingest a single knowledge entry directly. */
    fun ingestEntry(content: String, summary: String, type: String, source: String? = null, tags: String = ""): Long {
        val entry = KnowledgeEntry(
            content = content,
            summary = summary,
            type = type,
            tier = MemoryTier.WORKING.name,
            source = source,
            tags = tags
        )
        val id = knowledgeRepo.insert(entry)
        embeddingService?.embedAndStore(id, summary)
        return id
    }

    private fun ingestParsedDocument(doc: ParsedDocument, type: String): IngestResult {
        var embeddingsGenerated = 0
        val source = doc.metadata["source"] ?: ""
        val allIds = mutableListOf<Long>()

        for (section in doc.sections) {
            if (section.content.isBlank()) continue
            val chunks = chunker.chunk(section.content, doc.metadata)
            for (chunk in chunks) {
                val id = storeChunk(chunk, section.heading, type, source)
                allIds.add(id)
                if (generateEmbedding(id, chunk.content)) embeddingsGenerated++
            }
        }
        log("Ingested $source: ${allIds.size} entries, $embeddingsGenerated embeddings")
        return IngestResult(allIds.size, embeddingsGenerated, source, allIds)
    }

    private fun storeChunk(chunk: TextChunk, heading: String, type: String, source: String): Long {
        val summary = buildSummary(chunk.content, heading)
        val entry = KnowledgeEntry(
            content = chunk.content,
            summary = summary,
            type = type,
            tier = tierForType(type),
            source = source,
            sourceRef = "chunk:${chunk.index}",
            tags = heading
        )
        return knowledgeRepo.insert(entry)
    }

    /** Assign tier based on knowledge type. */
    private fun tierForType(type: String): String = when (type) {
        "REQUIREMENT", "ARCHITECTURE", "PROCEDURE", "API_DESIGN" -> MemoryTier.SEMANTIC.name
        "DECISION", "LESSON_LEARNED" -> MemoryTier.EPISODIC.name
        "ERROR_PATTERN" -> MemoryTier.PROCEDURAL.name
        else -> MemoryTier.WORKING.name
    }

    private fun buildSummary(content: String, heading: String): String {
        val firstLine = content.lines().firstOrNull { it.isNotBlank() } ?: ""
        val preview = firstLine.take(120)
        return if (heading.isNotBlank()) "$heading: $preview" else preview
    }

    private fun generateEmbedding(entryId: Long, text: String): Boolean {
        return embeddingService?.embedAndStore(entryId, text) ?: false
    }
}
