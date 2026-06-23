/**
 * CompressionMetrics — Observability
 * KSA-244: Tracks compression ratios, timing, cache hits, failures
 */
import { CompressionResult, MetricsEntry } from './types.js';
export declare class CompressionMetrics {
    private entries;
    private maxEntries;
    record(result: CompressionResult, durationMs: number, cacheHit?: boolean): void;
    getSummary(): {
        totalCompressions: number;
        avgRatio: number;
        avgDurationMs: number;
        cacheHitRate: number;
        skipRate: number;
        p99DurationMs: number;
    };
    getRecentEntries(count?: number): MetricsEntry[];
}
//# sourceMappingURL=metrics.d.ts.map