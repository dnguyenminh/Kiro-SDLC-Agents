/**
 * KSA-163: Circular Dependency Detector using Tarjan's SCC.
 */
import type { CircularDep } from './types.js';
import { GraphLoader } from './utils/GraphLoader.js';
export declare class CircularDepDetector {
    private graphLoader;
    constructor(graphLoader: GraphLoader);
    /** Find all circular dependencies in the codebase. */
    detect(options?: {
        module?: string;
        maxLength?: number;
    }): CircularDep[];
    private extractCycleChain;
    private classifySeverity;
}
