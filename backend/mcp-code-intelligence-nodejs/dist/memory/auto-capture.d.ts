/**
 * AutoCaptureHook — automatically captures knowledge from agent interactions.
 */
import { DecisionMemory } from './decision.js';
import { ErrorPatternMemory } from './error-pattern.js';
export interface CaptureConfig {
    enabled: boolean;
    captureToolCalls: boolean;
    captureDecisions: boolean;
    captureErrors: boolean;
    captureDocuments: boolean;
    minContentLength: number;
}
export declare class AutoCaptureHook {
    private pipeline;
    private decisions;
    private errors;
    private config;
    constructor(pipeline: any, decisions: DecisionMemory, errors: ErrorPatternMemory, config?: Partial<CaptureConfig>);
    /** Capture a tool call result as knowledge. */
    captureToolResult(toolName: string, result: string, source?: string): void;
    /** Capture a decision. */
    captureDecision(title: string, context: string, decision: string, rationale: string, source?: string): void;
    /** Capture an error pattern. */
    captureError(error: string, context: string, solution: string, source?: string): void;
    /** Capture a document. */
    captureDocument(content: string, source: string, format?: string): void;
}
//# sourceMappingURL=auto-capture.d.ts.map