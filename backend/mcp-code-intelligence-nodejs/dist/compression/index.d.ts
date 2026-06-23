/**
 * CompressionPipeline — Public API & Orchestrator
 * KSA-244: Entry point for the Context Compression Module
 *
 * Coordinates ContentRouter, SmartCrusher, CCRStore, CompressionCache,
 * CacheAligner, CircuitBreaker, and Metrics.
 *
 * Total budget: < 10ms per message (p99).
 */
import Database from 'better-sqlite3';
import { CCRStore } from './ccr-store.js';
import { Message } from './types.js';
export declare class CompressionPipeline {
    private contentRouter;
    private smartCrusher;
    private ccrStore;
    private cache;
    private cacheAligner;
    private circuitBreaker;
    private metrics;
    constructor(db: Database.Database);
    /**
     * Compress an array of messages for a given session.
     * BR-60: Only compress role "user"/"assistant" with string content
     * BR-61: Never compress tool_use or tool_result blocks
     * BR-62: System prompt: CacheAligner only
     * BR-63: Failsafe — errors never propagate
     */
    compress(messages: Message[], sessionId: string): Message[];
    private compressMessage;
    private compressContent;
    private alignSystemPrompt;
    /** Get metrics summary for monitoring */
    getMetrics(): {
        compression: {
            totalCompressions: number;
            avgRatio: number;
            avgDurationMs: number;
            cacheHitRate: number;
            skipRate: number;
            p99DurationMs: number;
        };
        cache: {
            hits: number;
            misses: number;
            hitRate: number;
            skipSetSize: number;
            resultCacheSize: number;
        };
        circuitBreaker: import("./types.js").CircuitBreakerState;
    };
    /** Get CCR Store for MCP tool access */
    getCCRStore(): CCRStore;
}
/**
 * Factory function — public API
 */
export declare function createCompressionPipeline(db: Database.Database): CompressionPipeline;
export { ContentRouter } from './content-router.js';
export { SmartCrusher } from './smart-crusher.js';
export { CCRStore } from './ccr-store.js';
export { CompressionCache } from './compression-cache.js';
export { CacheAligner } from './cache-aligner.js';
export { CircuitBreaker } from './circuit-breaker.js';
export { CompressionMetrics } from './metrics.js';
export * from './types.js';
//# sourceMappingURL=index.d.ts.map