/**
 * KSA-164: Taint Registry — Configuration of taint sources, sinks, and sanitizers.
 */
import type { TaintSourceType, TaintSinkType } from '../types.js';
export interface SourcePattern {
    type: TaintSourceType;
    patterns: string[];
    language?: string;
}
export interface SinkPattern {
    type: TaintSinkType;
    functions: string[];
    paramIndex: number;
    language?: string;
}
export interface SanitizerPattern {
    function: string;
    sanitizes: TaintSinkType[];
    language?: string;
}
export declare class TaintRegistry {
    private sources;
    private sinks;
    private sanitizers;
    constructor();
    /** Check if an expression matches a taint source pattern. */
    matchSource(expression: string, language?: string): {
        type: TaintSourceType;
    } | null;
    /** Check if a function call matches a taint sink. */
    matchSink(functionName: string, language?: string): SinkPattern | null;
    /** Check if a function is a sanitizer for a given sink type. */
    isSanitizer(functionName: string, sinkType: TaintSinkType, language?: string): boolean;
    /** Get all registered source types. */
    getSources(): SourcePattern[];
    /** Get all registered sink types. */
    getSinks(): SinkPattern[];
    /** Get all registered sanitizers. */
    getSanitizers(): SanitizerPattern[];
    /** Add custom source pattern. */
    addSource(source: SourcePattern): void;
    /** Add custom sink pattern. */
    addSink(sink: SinkPattern): void;
    /** Add custom sanitizer. */
    addSanitizer(sanitizer: SanitizerPattern): void;
    private loadDefaults;
}
//# sourceMappingURL=TaintRegistry.d.ts.map