/** Agent handoff memory — preserves context between agent sessions. */
package com.codeintel.memory.handoff

import com.codeintel.memory.models.KnowledgeEntry
import com.codeintel.memory.models.KnowledgeType
import com.codeintel.memory.models.MemoryTier
import com.codeintel.memory.repository.KnowledgeRepository
import com.codeintel.memory.repository.KnowledgeSearchRepository

/** Handoff context for agent transitions. */
data class HandoffContext(
    val fromAgent: String,
    val toAgent: String,
    val summary: String,
    val keyDecisions: List<String>,
    val openQuestions: List<String>,
    val artifacts: List<String>,
    val ticketKey: String? = null
)

class AgentHandoffMemory(
    private val repo: KnowledgeRepository,
    private val searchRepo: KnowledgeSearchRepository
) {

    /** Record a handoff between agents. */
    fun recordHandoff(ctx: HandoffContext): Long {
        val content = formatHandoff(ctx)
        val entry = KnowledgeEntry(
            content = content,
            summary = "Handoff: ${ctx.fromAgent} → ${ctx.toAgent}: ${ctx.summary.take(60)}",
            type = KnowledgeType.CONTEXT.name,
            tier = MemoryTier.WORKING.name,
            source = ctx.ticketKey,
            tags = "handoff,${ctx.fromAgent},${ctx.toAgent}"
        )
        return repo.insert(entry)
    }

    /** Get recent handoffs for an agent. */
    fun getHandoffsForAgent(agentName: String, limit: Int = 5): List<KnowledgeEntry> {
        val results = searchRepo.searchByTags(listOf("handoff", agentName), limit)
        return results.sortedByDescending { it.createdAt }
    }

    /** Get latest handoff context for a ticket. */
    fun getLatestForTicket(ticketKey: String): KnowledgeEntry? {
        val results = searchRepo.search("$ticketKey handoff", limit = 1)
        return results.firstOrNull()?.entry
    }

    private fun formatHandoff(ctx: HandoffContext): String {
        return buildString {
            appendLine("## Agent Handoff: ${ctx.fromAgent} → ${ctx.toAgent}")
            appendLine("\n### Summary\n${ctx.summary}")
            if (ctx.keyDecisions.isNotEmpty()) {
                appendLine("\n### Key Decisions")
                ctx.keyDecisions.forEach { appendLine("- $it") }
            }
            if (ctx.openQuestions.isNotEmpty()) {
                appendLine("\n### Open Questions")
                ctx.openQuestions.forEach { appendLine("- $it") }
            }
            if (ctx.artifacts.isNotEmpty()) {
                appendLine("\n### Artifacts")
                ctx.artifacts.forEach { appendLine("- $it") }
            }
        }
    }
}
