/**
 * KSA-162: Main Function Detector — Detects main() entry points.
 */
import type { EntryPoint } from '../types.js';
import { PatternRegistry } from '../PatternRegistry.js';
export declare class MainDetector {
    private registry;
    constructor(registry: PatternRegistry);
    /** Detect main entry points from source code. */
    detect(symbols: Array<{
        id: number;
        name: string;
        filePath: string;
        startLine: number;
    }>, source: string, language: string): EntryPoint[];
    private createEntryPoint;
}
//# sourceMappingURL=MainDetector.d.ts.map