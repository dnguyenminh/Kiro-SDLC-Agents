/** Document ingestion pipeline — parse, chunk, embed, store. Enhanced with quality gate (KSA-110 F4). */
package com.codeintel.memory.ingest

import com.codeintel.log
import com.codeintel.memory.embedding.EmbeddingService
import com.codeintel.memory.ingest.autolink.AutoLinkResult
import com.codeintel.memory.ingest.autolink.AutoLinker
import com.codeintel.memory.models.KnowledgeEntry
import com.codeintel.memory.models.KnowledgeType
import com.codeintel.memory.models.MemoryTier
import com.codeintel.memory.repository.KnowledgeRepository
import com.codeintel.memory.search.IngestMeta
import com.codeintel.memory.search.QualityGate
import com.codeintel.memory.search.QualityResult

/** Result of ingesting a document. */
data class IngestResult(
    val entriesCreated: Int,
    val embeddingsGenerated: Int = 0,
    val source: String,
    val entryIds: List<Long> = emptyList(),
    val skipped: Boolean = false,
    val skipReason: String? = null,
    val autoLinkResult: AutoLinkResult? = null
)

/** Error thrown when quality gate rejects content. */
class QualityRejectionException(val quality: QualityResult) :
    RuntimeException(quality.message ?: "Quality gate rejected content")

class IngestPipeline(
    private val knowledgeRepo: KnowledgeRepository,
    private val embeddingService: EmbeddingService?,
    private val chunker: ChunkingStrategy = SemanticChunker()
) {
    private var qualityGate: QualityGate? = null
    private var autoLinker: AutoLinker? = null
    private var contradictionResolver: com.codeintel.memory.contradiction.ContradictionResolver? = null

    /** Inject QualityGate for ingest validation. */
    fun setQualityGate(gate: QualityGate) { this.qualityGate = gate }

    /** Inject AutoLinker for post-ingest linking (KSA-190). */
    fun setAutoLinker(linker: AutoLinker) { this.autoLinker = linker }

    /** Inject ContradictionResolver for detecting conflicting info on ingest. */
    fun setContradictionResolver(resolver: com.codeintel.memory.contradiction.ContradictionResolver) { this.contradictionResolver = resolver }

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

    /** Ingest a single knowledge entry directly. Quality gate applied if set. */
    fun ingestEntry(content: String, summary: String, type: String, source: String? = null, tags: String = ""): Long {
        qualityGate?.let { gate ->
            val quality = gate.validate(content, IngestMeta(tags, type, source))
            if (quality.decision == "reject") throw QualityRejectionException(quality)
        }

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
        trySetQualityScore(id, content, tags, type, source)
        tryAutoLink(id)
        tryDetectContradiction(id)
        return id
    }

    /** Update agent_name for a knowledge entry after ingest. */
    fun updateAgentName(id: Long, agentName: String) {
        knowledgeRepo.updateAgentName(id, agentName)
    }

    /** Fire-and-forget auto-linking after ingest (KSA-190). */
    private fun tryAutoLink(entryId: Long): AutoLinkResult? {
        val linker = autoLinker ?: return null
        return try {
            linker.link(entryId)
        } catch (e: Exception) {
            log("[ingest] Auto-link failed for entry $entryId: $e")
            null
        }
    }

    /** Detect contradictions with existing entries after ingest. */
    private fun tryDetectContradiction(entryId: Long) {
        val resolver = contradictionResolver ?: return
        try {
            resolver.detectAndResolve(entryId)
        } catch (e: Exception) {
            log("[ingest] Contradiction detection failed for entry $entryId: $e")
        }
    }

    private fun trySetQualityScore(id: Long, content: String, tags: String, type: String, source: String?) {
        val gate = qualityGate ?: return
        try {
            val result = gate.validate(content, IngestMeta(tags, type, source))
            knowledgeRepo.updateQualityScore(id, result.score)
        } catch (_: Exception) { /* quality scoring must not break ingest */ }
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
        // Auto-link last entry in batch (representative)
        val linkResult = if (allIds.isNotEmpty()) tryAutoLink(allIds.last()) else null
        log("Ingested $source: ${allIds.size} entries, $embeddingsGenerated embeddings")
        return IngestResult(allIds.size, embeddingsGenerated, source, allIds, autoLinkResult = linkResult)
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
