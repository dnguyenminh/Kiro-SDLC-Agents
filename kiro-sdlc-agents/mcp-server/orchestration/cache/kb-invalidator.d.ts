/**
 * KbCacheInvalidator — remove stale cache entries on permanent failure.
 * KSA-139: Classifies errors and invalidates only on permanent failures.
 */
export declare class KbCacheInvalidator {
    private memoryEngine;
    constructor(memoryEngine: any);
    /** Handle failed tool execution — invalidate if permanent error. */
    onFailure(toolName: string, agentName: string, errorMessage: string): Promise<void>;
    /** Bulk invalidate all entries for a disconnected server. */
    invalidateServer(serverName: string): Promise<number>;
    /** Delete a specific cache entry by scope + toolName. */
    private deleteEntry;
    /** Delete KB entry by ID (best-effort). */
    private deleteById;
}
//# sourceMappingURL=kb-invalidator.d.ts.map