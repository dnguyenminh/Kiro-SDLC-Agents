"use strict";
/**
 * AutoCaptureHook — automatically captures knowledge from agent interactions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoCaptureHook = void 0;
const DEFAULT_CONFIG = {
    enabled: true,
    captureToolCalls: true,
    captureDecisions: true,
    captureErrors: true,
    captureDocuments: true,
    minContentLength: 50,
};
class AutoCaptureHook {
    pipeline;
    decisions;
    errors;
    config;
    constructor(pipeline, decisions, errors, config) {
        this.pipeline = pipeline;
        this.decisions = decisions;
        this.errors = errors;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /** Capture a tool call result as knowledge. */
    captureToolResult(toolName, result, source) {
        if (!this.config.captureToolCalls)
            return;
        if (result.length < this.config.minContentLength)
            return;
        this.pipeline.ingestEntry(result, `Tool result: ${toolName}`, 'CONTEXT', source, `auto-capture,tool,${toolName}`);
    }
    /** Capture a decision. */
    captureDecision(title, context, decision, rationale, source) {
        if (!this.config.captureDecisions)
            return;
        this.decisions.recordDecision({
            title, context, decision, rationale, source, tags: 'auto-capture',
        });
    }
    /** Capture an error pattern. */
    captureError(error, context, solution, source) {
        if (!this.config.captureErrors)
            return;
        this.errors.recordError({
            errorMessage: error, context, rootCause: 'Auto-detected',
            solution, source, tags: 'auto-capture',
        });
    }
    /** Capture a document. */
    captureDocument(content, source, format = 'markdown') {
        if (!this.config.captureDocuments)
            return;
        if (content.length < this.config.minContentLength)
            return;
        if (format === 'markdown') {
            this.pipeline.ingestMarkdown(content, source);
        }
        else {
            this.pipeline.ingestText(content, source);
        }
    }
}
exports.AutoCaptureHook = AutoCaptureHook;
//# sourceMappingURL=auto-capture.js.map