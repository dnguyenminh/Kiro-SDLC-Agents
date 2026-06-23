/**
 * KSA-163: Hot Path Analyzer — Finds most-called functions via transitive callers.
 */
import type { HotPath } from './types.js';
import { GraphLoader } from './utils/GraphLoader.js';
export declare class HotPathAnalyzer {
    private graphLoader;
    constructor(graphLoader: GraphLoader);
    /** Find hot paths (functions with most callers). */
    analyze(options?: {
        limit?: number;
        minCallers?: number;
        module?: string;
    }): HotPath[];
    /** Compute transitive caller count using BFS on reverse graph. */
    private computeTransitiveCallers;
}
