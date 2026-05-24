/**
 * mem_sync_code — sync code symbols into memory graph with IMPLEMENTED_BY edges.
 */
export declare class MemSyncCode {
    private engine;
    private queryLayer;
    private graph;
    constructor(engine: any, queryLayer: any, graph: any);
    /** Sync code symbols into memory graph. */
    execute(args: Record<string, any>): string;
    private fetchSymbols;
    private ingestSymbols;
    private isAlreadyIngested;
    private createCodeEntry;
    private buildContent;
    private linkToDocuments;
    private findRelatedDocEntries;
}
//# sourceMappingURL=sync-code.d.ts.map