/**
 * Consolidated dispatcher — routes 17 tools + backward-compatible aliases.
 * Thin routing layer that delegates to existing V1/V2 handler classes.
 */
import type { MemoryToolDispatcherV2 } from './tool-dispatcher-v2.js';
import type { CoreMemoryManager } from './core-memory.js';
import type { EntityRepository } from './entity-repo.js';
import type { KnowledgeRepository } from './knowledge-repo.js';
import type { ConversationRepository } from './conversation-repo.js';
import type { ConversationSummarizer } from './conversation-summarizer.js';
type Args = Record<string, unknown>;
type V1Dispatcher = {
    dispatch(name: string, args: Args): string | null;
};
export declare class MemoryToolDispatcherConsolidated {
    private readonly v1;
    private readonly v2;
    private coreMemory;
    private entityRepo;
    private knowledgeRepo;
    private conversationRepo;
    private conversationSummarizer;
    constructor(v1: V1Dispatcher, v2: MemoryToolDispatcherV2);
    /** Inject CoreMemoryManager after construction (avoids circular deps). */
    setCoreMemory(cm: CoreMemoryManager): void;
    /** Inject EntityRepository + KnowledgeRepository for mem_map. */
    setMapDeps(entityRepo: EntityRepository, knowledgeRepo: KnowledgeRepository): void;
    /** Inject ConversationRepository + Summarizer for mem_conversation. */
    setConversationDeps(repo: ConversationRepository, summarizer: ConversationSummarizer): void;
    /** Dispatch tool call. Handles new names + aliases. */
    dispatch(name: string, args: Args): string | null;
    private resolveAlias;
}
export {};
//# sourceMappingURL=tool-dispatcher-consolidated.d.ts.map