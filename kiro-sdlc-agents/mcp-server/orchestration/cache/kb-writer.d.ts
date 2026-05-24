/**
 * KbCacheWriter — ingest/update cache entries in KB on successful execution.
 * KSA-139: Async fire-and-forget writes, dedup by title.
 */
import { CacheSource } from './kb-models.js';
import { KbCacheConfig } from './kb-config.js';
export declare class KbCacheWriter {
    private memoryEngine;
    private config;
    constructor(memoryEngine: any, config: KbCacheConfig);
    /** Update config (hot-reload support). */
    updateConfig(config: KbCacheConfig): void;
    /** Handle successful tool execution — ingest/update cache entries. */
    onSuccess(toolName: string, serverName: string, description: string, inputSchema: Record<string, any>, agentName: string, source: CacheSource): Promise<void>;
    /** Ingest a new cache entry into KB. */
    private ingestEntry;
    /** Increment hit count for an existing entry (best-effort). */
    private incrementHits;
}
//# sourceMappingURL=kb-writer.d.ts.map