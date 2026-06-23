/**
 * MemoryToolDispatcher — routes all mem_* tool calls.
 * Handles 14 consolidated tools + backward-compatible aliases.
 */
import type { MemoryEngine } from './MemoryEngine.js';
import type { QueryLayer } from '../../engine/query/query-layer.js';
type Args = Record<string, unknown>;
export declare class MemoryToolDispatcher {
    private readonly engine;
    private readonly workspace;
    private readonly queryLayer?;
    constructor(engine: MemoryEngine, workspace: string, queryLayer?: QueryLayer | undefined);
    dispatch(name: string, args: Args): string | null;
    private resolveAlias;
    private handleSearch;
    private handleIngest;
    private handleIngestFile;
    private handlePin;
    private handleMap;
    private handleCrud;
    private handleGraph;
    private handleConsolidate;
    private handleLifecycle;
    private handleTemplates;
    private handleAttachments;
    private handleDiscover;
    private handleTags;
    private handleCitations;
    private handleConversation;
    private handleScoring;
    private handleAdmin;
    private tierForType;
    private inferOwner;
    private handleSyncCode;
    private resolvePath;
}
export {};
