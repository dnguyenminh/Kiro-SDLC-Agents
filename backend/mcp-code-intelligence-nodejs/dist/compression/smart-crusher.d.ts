/**
 * SmartCrusher — JSON Array Compression (CORE)
 * KSA-244: Entropy-based field analysis + strategy selection + item sampling
 *
 * Achieves 60-90% compression on JSON arrays while preserving semantic meaning.
 * Budget: < 5ms for 100 items, < 10ms total pipeline.
 */
import { CompressionOptions, CompressionResult } from './types.js';
export declare class SmartCrusher {
    /**
     * Compress a JSON array using entropy-based field analysis.
     * Returns original if compression is not beneficial.
     */
    compress(items: any[], options?: CompressionOptions): CompressionResult;
    private skip;
    private samplePrimitives;
}
//# sourceMappingURL=smart-crusher.d.ts.map