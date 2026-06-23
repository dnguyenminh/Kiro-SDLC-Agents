/**
 * KSA-160: RRF Merger — Reciprocal Rank Fusion for merging multi-source results.
 */
import { SourceWeights, MergedResult } from './types.js';
interface SourceResults {
    source: string;
    results: any[];
}
export declare class RRFMerger {
    private k;
    /** Merge results from multiple sources using Reciprocal Rank Fusion. */
    merge(sources: {
        code: SourceResults;
        memory: SourceResults;
        graph: SourceResults;
    }, weights?: SourceWeights): MergedResult[];
    private addScores;
    private getKey;
}
export {};
//# sourceMappingURL=rrf-merger.d.ts.map