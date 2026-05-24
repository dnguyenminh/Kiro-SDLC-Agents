"use strict";
/**
 * Auto-logger — logs tool calls to memory audit trail.
 * Behavioral parity with Kotlin AutoLogger.kt.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoLogger = void 0;
class AutoLogger {
    memoryEngine;
    settings;
    constructor(memoryEngine, settings) {
        this.memoryEngine = memoryEngine;
        this.settings = settings;
    }
    logCall(tool, args, result, latencyMs, source, isError = false) {
        if (!this.settings.enabled)
            return;
        if (this.settings.excludeTools.includes(tool))
            return;
        if (!this.memoryEngine)
            return;
        const truncatedArgs = args.substring(0, this.settings.maxArgLength);
        let details = `${tool}(${truncatedArgs}) → ${latencyMs}ms [${source}]`;
        if (isError)
            details += ' [ERROR]';
        try {
            this.memoryEngine.audit.log('TOOL_CALL', undefined, this.memoryEngine.getSessionId?.(), details);
        }
        catch { /* graceful degradation */ }
    }
}
exports.AutoLogger = AutoLogger;
//# sourceMappingURL=auto-logger.js.map