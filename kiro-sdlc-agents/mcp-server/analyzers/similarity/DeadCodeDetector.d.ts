/**
 * KSA-168: Dead Code Detector — Find unreachable code using call graph reachability.
 * BFS from entry points through call graph, then score unreachable functions.
 */
import Database from 'better-sqlite3';
import type { DeadCodeReport } from './types.js';
export declare class DeadCodeDetector {
    private db;
    private minConfidence;
    constructor(db: Database.Database, minConfidence?: number);
    /** Detect dead code with confidence scoring. */
    detect(options?: {
        filePath?: string;
        module?: string;
        limit?: number;
    }): DeadCodeReport;
    private getEntryPoints;
    private computeReachability;
    private getAllFunctions;
    private scoreCandidate;
    private hasTestReferences;
    private isLifecycleMethod;
}
//# sourceMappingURL=DeadCodeDetector.d.ts.map