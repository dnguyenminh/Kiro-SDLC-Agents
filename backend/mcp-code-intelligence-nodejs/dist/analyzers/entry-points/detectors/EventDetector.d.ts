/**
 * KSA-162: Event/MQ/Scheduled Handler Detector.
 */
import type { EntryPoint } from '../types.js';
export declare class EventDetector {
    /** Detect event/scheduled handlers. */
    detect(symbols: Array<{
        id: number;
        name: string;
        decorators?: string[];
        filePath: string;
        startLine: number;
    }>, source: string): EntryPoint[];
    private extractEventName;
    private getContext;
}
//# sourceMappingURL=EventDetector.d.ts.map