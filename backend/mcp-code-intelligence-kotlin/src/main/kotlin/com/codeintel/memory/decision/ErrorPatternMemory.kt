/** Error pattern memory — tracks recurring errors and their solutions. */
package com.codeintel.memory.decision

import com.codeintel.memory.models.KnowledgeEntry
import com.codeintel.memory.models.KnowledgeType
import com.codeintel.memory.models.MemoryTier
import com.codeintel.memory.repository.KnowledgeRepository

/** A structured error pattern. */
data class ErrorPattern(
    val errorMessage: String,
    val context: String,
    val rootCause: String,
    val solution: String,
    val prevention: String = "",
    val source: String? = null,
    val tags: String = ""
)

class ErrorPatternMemory(private val repo: KnowledgeRepository) {

    /** Record a new error pattern. */
    fun recordError(pattern: ErrorPattern): Long {
        val content = formatErrorContent(pattern)
        val entry = KnowledgeEntry(
            content = content,
            summary = "Error: ${pattern.errorMessage.take(80)}",
            type = KnowledgeType.ERROR_PATTERN.name,
            tier = MemoryTier.EPISODIC.name,
            source = pattern.source,
            tags = pattern.tags,
            confidence = 0.8
        )
        return repo.insert(entry)
    }

    /** Find error patterns. */
    fun findErrors(limit: Int = 20): List<KnowledgeEntry> {
        return repo.findByType(KnowledgeType.ERROR_PATTERN.name, limit)
    }

    private fun formatErrorContent(p: ErrorPattern): String {
        return buildString {
            appendLine("## Error\n${p.errorMessage}")
            appendLine("\n## Context\n${p.context}")
            appendLine("\n## Root Cause\n${p.rootCause}")
            appendLine("\n## Solution\n${p.solution}")
            if (p.prevention.isNotBlank()) {
                appendLine("\n## Prevention\n${p.prevention}")
            }
        }
    }
}
