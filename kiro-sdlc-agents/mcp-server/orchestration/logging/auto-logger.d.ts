/**
 * Auto-logger — logs tool calls to memory audit trail.
 * Behavioral parity with Kotlin AutoLogger.kt.
 */
import { AutoLogSettings } from '../config.js';
export declare class AutoLogger {
    private memoryEngine;
    private settings;
    constructor(memoryEngine: any, settings: AutoLogSettings);
    logCall(tool: string, args: string, result: string, latencyMs: number, source: string, isError?: boolean): void;
}
//# sourceMappingURL=auto-logger.d.ts.map