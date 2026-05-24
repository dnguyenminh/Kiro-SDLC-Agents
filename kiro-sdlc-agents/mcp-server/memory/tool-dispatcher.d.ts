/**
 * MemoryToolDispatcher — routes mem_* tool calls to handlers.
 */
import { MemoryEngine } from './memory-engine.js';
import { EmbeddingService } from './embedding/index.js';
export declare class MemoryToolDispatcher {
    private readonly engine;
    private readonly pipeline;
    private readonly hybridSearch;
    private readonly consolidator;
    private readonly workspace;
    private syncCode;
    private queryLayer;
    constructor(engine: MemoryEngine, workspace: string, embeddingService?: EmbeddingService | null, queryLayer?: any);
    /** Dispatch a memory tool call. Returns null if not a memory tool. */
    dispatch(name: string, args: Record<string, unknown>): string | null;
    private handleSearch;
    /** Log search to search_log + popular_queries for analytics page. */
    logSearchAnalytics(query: string, resultCount: number): void;
    /** Increment access_count and auto-cite entries from search results. */
    private recordAccessAndCitations;
    private handleIngest;
    /** Auto-set owner based on source field. */
    private autoOwnEntry;
    private inferOwner;
    /** Auto-compute quality score for newly ingested entry. */
    private autoScoreEntry;
    private handleIngestFile;
    private handleGet;
    private handleDelete;
    private handleList;
    private handleGraph;
    private graphNeighbors;
    private graphAddEdge;
    private graphPath;
    private graphEgo;
    private handleStatus;
    private handleConsolidate;
    private handleAudit;
    private handleSessions;
    private handleSyncCode;
    private resolvePath;
}
//# sourceMappingURL=tool-dispatcher.d.ts.map