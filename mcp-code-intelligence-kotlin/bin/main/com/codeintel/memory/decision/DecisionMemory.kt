/** Decision memory — tracks architectural decisions and their rationale. */
package com.codeintel.memory.decision

import com.codeintel.memory.models.GraphEdge
import com.codeintel.memory.models.KnowledgeEntry
import com.codeintel.memory.models.KnowledgeType
import com.codeintel.memory.models.MemoryTier
import com.codeintel.memory.repository.GraphRepository
import com.codeintel.memory.repository.KnowledgeRepository

/** A structured decision record. */
data class Decision(
    val title: String,
    val context: String,
    val decision: String,
    val rationale: String,
    val alternatives: List<String> = emptyList(),
    val consequences: String = "",
    val source: String? = null,
    val tags: String = ""
)

class DecisionMemory(
    private val repo: KnowledgeRepository,
    private val graphRepo: GraphRepository
) {

    /** Record a new decision. */
    fun recordDecision(decision: Decision): Long {
        val content = formatDecisionContent(decision)
        val entry = KnowledgeEntry(
            content = content,
            summary = "Decision: ${decision.title}",
            type = KnowledgeType.DECISION.name,
            tier = MemoryTier.EPISODIC.name,
            source = decision.source,
            tags = decision.tags,
            confidence = 0.9
        )
        return repo.insert(entry)
    }

    /** Link a decision to related entries. */
    fun linkDecision(decisionId: Long, relatedId: Long, relation: String = "RELATES_TO") {
        graphRepo.addEdge(GraphEdge(
            sourceId = decisionId,
            targetId = relatedId,
            relation = relation
        ))
    }

    /** Find decisions related to a topic. */
    fun findDecisions(limit: Int = 20): List<KnowledgeEntry> {
        return repo.findByType(KnowledgeType.DECISION.name, limit)
    }

    private fun formatDecisionContent(d: Decision): String {
        return buildString {
            appendLine("## Context\n${d.context}")
            appendLine("\n## Decision\n${d.decision}")
            appendLine("\n## Rationale\n${d.rationale}")
            if (d.alternatives.isNotEmpty()) {
                appendLine("\n## Alternatives Considered")
                d.alternatives.forEach { appendLine("- $it") }
            }
            if (d.consequences.isNotBlank()) {
                appendLine("\n## Consequences\n${d.consequences}")
            }
        }
    }
}
