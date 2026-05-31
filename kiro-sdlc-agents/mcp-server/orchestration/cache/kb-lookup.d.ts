/**
 * KbCacheLookup — search KB for cached tools using L2 → L1 cascade.
 * KSA-139: Agent-scope first, then global scope, with timeout guard.
 */
import { ToolCacheEntry, CacheSource } from './kb-models.js';
import { KbCacheConfig } from './kb-config.js';
export interface KbLookupResult {
    entry: ToolCacheEntry;
    source: CacheSource;
}
export declare class KbCacheLookup {
    private memoryEngine;
    private config;
    constructor(memoryEngine: any, config: KbCacheConfig);
    /** Update config (hot-reload support). */
    updateConfig(config: KbCacheConfig): void;
    /** Lookup cascade: L2 (agent scope) → L1 (global scope). */
    find(query: string, agentName: string): Promise<KbLookupResult | null>;
    /** Synchronous lookup — best-effort using in-memory search (KSA-141).
     *  Returns result if KB search is synchronous, null otherwise. */
    findSync(query: string, agentName: string): KbLookupResult | null;
    /** Synchronous scope search — returns null if search is async-only. */
    private searchScopeSync;
    /** Search KB with specific scope tags. Returns best match or null. */
    private searchScope;
    /** Search KB with timeout guard. */
    private searchWithTimeout;
    /** Extract content string from KB search result. */
    private extractContent;
}
//# sourceMappingURL=kb-lookup.d.ts.map