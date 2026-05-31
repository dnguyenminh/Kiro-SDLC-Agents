/**
 * KSA-162: CLI Command Detector — Detects CLI command entry points.
 */
import type { EntryPoint } from '../types.js';
export declare class CLIDetector {
    /** Detect CLI command entry points. */
    detect(symbols: Array<{
        id: number;
        name: string;
        decorators?: string[];
        filePath: string;
        startLine: number;
    }>, source: string): EntryPoint[];
}
//# sourceMappingURL=CLIDetector.d.ts.map