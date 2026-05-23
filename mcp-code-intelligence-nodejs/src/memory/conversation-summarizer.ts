/**
 * ConversationSummarizer — compresses old conversation turns into summary entries.
 * Runs on session end or when turn count exceeds threshold.
 */

import { ConversationRepository, ConversationTurn } from './conversation-repo.js';
import { KnowledgeRepository } from './knowledge-repo.js';

export interface SummarizeResult {
  sessionId: string;
  turnsProcessed: number;
  summaryEntryId: number;
}

export class ConversationSummarizer {
  private readonly conversations: ConversationRepository;
  private readonly knowledge: KnowledgeRepository;
  private readonly maxTurnsBeforeSummarize: number;

  constructor(conversations: ConversationRepository, knowledge: KnowledgeRepository, maxTurns = 50) {
    this.conversations = conversations;
    this.knowledge = knowledge;
    this.maxTurnsBeforeSummarize = maxTurns;
  }

  /** Summarize a session's conversation into a knowledge entry. */
  summarizeSession(sessionId: string): SummarizeResult | null {
    const turns = this.conversations.getSession(sessionId, 200);
    if (turns.length === 0) return null;
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
  needsSummarization(sessionId: string): boolean {
    const count = this.conversations.getSessionTurnCount(sessionId);
    return count >= this.maxTurnsBeforeSummarize;
  }

  private buildSummary(turns: ConversationTurn[]): string {
    const roles = [...new Set(turns.map(t => t.role))];
    const firstTopic = turns[0]?.content.slice(0, 80) ?? 'conversation';
    return `Conversation (${turns.length} turns, roles: ${roles.join(',')}): ${firstTopic}`;
  }

  private buildContent(turns: ConversationTurn[]): string {
    const lines: string[] = [`# Conversation Summary (${turns.length} turns)\n`];
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
