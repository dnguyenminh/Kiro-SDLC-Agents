"use strict";
/**
 * ConversationSummarizer — compresses old conversation turns into summary entries.
 * Runs on session end or when turn count exceeds threshold.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationSummarizer = void 0;
class ConversationSummarizer {
    conversations;
    knowledge;
    maxTurnsBeforeSummarize;
    constructor(conversations, knowledge, maxTurns = 50) {
        this.conversations = conversations;
        this.knowledge = knowledge;
        this.maxTurnsBeforeSummarize = maxTurns;
    }
    /** Summarize a session's conversation into a knowledge entry. */
    summarizeSession(sessionId) {
        const turns = this.conversations.getSession(sessionId, 200);
        if (turns.length === 0)
            return null;
        const summary = this.buildSummary(turns);
        const content = this.buildContent(turns);
        const id = this.knowledge.insert({
            content,
            summary,
            type: 'CONVERSATION',
            tier: 'EPISODIC',
            source: `session:${sessionId}`,
            tags: `conversation,${sessionId}`,
        });
        return { sessionId, turnsProcessed: turns.length, summaryEntryId: id };
    }
    /** Check if session needs summarization. */
    needsSummarization(sessionId) {
        const count = this.conversations.getSessionTurnCount(sessionId);
        return count >= this.maxTurnsBeforeSummarize;
    }
    buildSummary(turns) {
        const roles = [...new Set(turns.map(t => t.role))];
        const firstTopic = turns[0]?.content.slice(0, 80) ?? 'conversation';
        return `Conversation (${turns.length} turns, roles: ${roles.join(',')}): ${firstTopic}`;
    }
    buildContent(turns) {
        const lines = [`# Conversation Summary (${turns.length} turns)\n`];
        for (const turn of turns.slice(0, 100)) {
            const prefix = `[${turn.role}] `;
            const text = turn.content.slice(0, 300);
            lines.push(`${prefix}${text}`);
        }
        if (turns.length > 100) {
            lines.push(`\n... (${turns.length - 100} more turns truncated)`);
        }
        return lines.join('\n');
    }
}
exports.ConversationSummarizer = ConversationSummarizer;
//# sourceMappingURL=conversation-summarizer.js.map