/**
 * ConversationSummarizer — compresses old conversation turns into summary entries.
 * Runs on session end or when turn count exceeds threshold.
 */
import { ConversationRepository } from './conversation-repo.js';
import { KnowledgeRepository } from './knowledge-repo.js';
export interface SummarizeResult {
    sessionId: string;
    turnsProcessed: number;
    summaryEntryId: number;
}
export declare class ConversationSummarizer {
    private readonly conversations;
    private readonly knowledge;
    private readonly maxTurnsBeforeSummarize;
    constructor(conversations: ConversationRepository, knowledge: KnowledgeRepository, maxTurns?: number);
    /** Summarize a session's conversation into a knowledge entry. */
    summarizeSession(sessionId: string): SummarizeResult | null;
    /** Check if session needs summarization. */
    needsSummarization(sessionId: string): boolean;
    private buildSummary;
    private buildContent;
}
//# sourceMappingURL=conversation-summarizer.d.ts.map