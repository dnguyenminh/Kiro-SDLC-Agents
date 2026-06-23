/**
 * KSA-163: Related Test Finder — Reverse BFS on call graph to find tests.
 */
import type { RelatedTestResult } from './types.js';
import { GraphLoader } from './utils/GraphLoader.js';
export declare class RelatedTestFinder {
    private graphLoader;
    private testDetector;
    constructor(graphLoader: GraphLoader);
    /** Find tests related to a symbol (by name or ID). */
    find(symbolName: string, options?: {
        maxDepth?: number;
        filePath?: string;
    }): RelatedTestResult | null;
    private reverseBFS;
}
