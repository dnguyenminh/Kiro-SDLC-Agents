/**
 * Context Compression Module — Shared Interfaces
 * KSA-244: Port Headroom Algorithms to Node.js
 */
export type ContentType = 'json' | 'json_object' | 'code' | 'logs' | 'text' | 'search' | 'empty' | 'short';
export interface ContentClassification {
    type: ContentType;
    shouldCompress: boolean;
    compressor: 'smartCrusher' | null;
}
export interface CompressionOptions {
    targetRatio?: number;
    preserveFields?: string[];
    timeoutMs?: number;
}
export interface CompressionResult {
    compressed: string;
    originalSize: number;
    compressedSize: number;
    ratio: number;
    strategy: 'field_reduction' | 'item_sampling' | 'hybrid' | 'none';
    skipped: boolean;
}
export interface CacheResult {
    hit: boolean;
    source: 'skip_set' | 'result_cache' | 'miss';
    result?: CompressionResult;
}
export interface CCREntry {
    key: string;
    original: string;
    contentType: string;
    compressedAt: number;
    expiresAt: number;
    lastAccessed: number;
    sizeBytes: number;
}
export interface AlignedPrompt {
    prompt: string;
    extractedDates: Array<{
        placeholder: string;
        value: string;
    }>;
    modified: boolean;
}
export interface Message {
    role: string;
    content: any;
}
export interface MetricsEntry {
    timestamp: number;
    originalSize: number;
    compressedSize: number;
    ratio: number;
    strategy: string;
    durationMs: number;
    cacheHit: boolean;
    skipped: boolean;
}
export interface CircuitBreakerState {
    state: 'closed' | 'open' | 'half_open';
    failures: number;
    lastFailureAt: number;
    lastStateChange: number;
}
//# sourceMappingURL=types.d.ts.map