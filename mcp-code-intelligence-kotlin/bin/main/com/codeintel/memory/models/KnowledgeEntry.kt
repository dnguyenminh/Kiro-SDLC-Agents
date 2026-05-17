/** Data models for knowledge entries stored in memory engine. */
package com.codeintel.memory.models

import kotlinx.serialization.Serializable

/** Consolidation tier for knowledge lifecycle. */
enum class MemoryTier { WORKING, EPISODIC, SEMANTIC, PROCEDURAL }

/** Type of knowledge stored. */
enum class KnowledgeType {
    DECISION, ERROR_PATTERN, ARCHITECTURE, API_DESIGN,
    REQUIREMENT, LESSON_LEARNED, PROCEDURE, CONTEXT
}

/** A single knowledge entry in the memory system. */
@Serializable
data class KnowledgeEntry(
    val id: Long = 0,
    val content: String,
    val summary: String,
    val type: String,
    val tier: String = MemoryTier.WORKING.name,
    val source: String? = null,
    val sourceRef: String? = null,
    val tags: String = "",
    val confidence: Double = 1.0,
    val accessCount: Int = 0,
    val createdAt: String = "",
    val updatedAt: String = "",
    val lastAccessedAt: String? = null,
    val expiresAt: String? = null
)

/** Search result with relevance score. */
@Serializable
data class KnowledgeSearchResult(
    val entry: KnowledgeEntry,
    val score: Double,
    val matchType: String = "fts"
)
