/**
 * ConversationSummarizer — compresses old turns into summary entries.
 * Port of Node.js conversation-summarizer.ts (KSA-142 F2).
 */
package com.codeintel.memory.conversation

import com.codeintel.memory.models.KnowledgeEntry
import com.codeintel.memory.repository.KnowledgeRepository

data class SummarizeResult(
    val sessionId: String,
    val turnsProcessed: Int,
    val summaryEntryId: Long
)

class ConversationSummarizer(
    private val conversations: ConversationRepository,
    private val knowledge: KnowledgeRepository,
    private val maxTurns: Int = 50
) {
    /** Summarize a session's conversation into a knowledge entry. */
    fun summarizeSession(sessionId: String): SummarizeResult? {
        val turns = conversations.getSession(sessionId, limit = 200)
        if (turns.isEmpty()) return null
        val summary = buildSummary(turns)
        val content = buildContent(turns)
        val entry = KnowledgeEntry(
            content = content,
            summary = summary,
            type = "CONVERSATION",
            tier = "EPISODIC",
            source = "session:$sessionId",
            tags = "conversation,$sessionId"
        )
        val id = knowledge.insert(entry)
        return SummarizeResult(sessionId, turns.size, id)
    }

    /** Check if session needs summarization. */
    fun needsSummarization(sessionId: String): Boolean {
        return conversations.getSessionTurnCount(sessionId) >= maxTurns
    }

    private fun buildSummary(turns: List<ConversationTurn>): String {
        val roles = turns.map { it.role }.distinct()
        val firstTopic = turns.firstOrNull()?.content?.take(80) ?: "conversation"
        return "Conversation (${turns.size} turns, roles: ${roles.joinToString(",")}): $firstTopic"
    }

    private fun buildContent(turns: List<ConversationTurn>): String {
        val lines = mutableListOf("# Conversation Summary (${turns.size} turns)\n")
        for (turn in turns.take(100)) {
            lines.add("[${turn.role}] ${turn.content.take(300)}")
        }
        if (turns.size > 100) {
            lines.add("\n... (${turns.size - 100} more turns truncated)")
        }
        return lines.joinToString("\n")
    }
}
