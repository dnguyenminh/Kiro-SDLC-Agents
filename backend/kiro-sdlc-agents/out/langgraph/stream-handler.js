"use strict";
/**
 * StreamHandler — KSA-210
 * Bridges LangGraph node events to Chat Panel postMessage protocol.
 * Token events are debounced (50ms); status/complete/error flush immediately.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamHandler = void 0;
/** Maximum buffer size to prevent memory issues */
const MAX_BUFFER_SIZE = 100;
class StreamHandler {
    emit;
    buffer = [];
    flushTimer = null;
    DEBOUNCE_MS = 50;
    constructor(emit) {
        this.emit = emit;
    }
    /** Buffer token events, flush on debounce window */
    emitToken(nodeId, content, streamId) {
        this.buffer.push({
            type: "chat:streamChunk",
            streamId: streamId ?? `stream-${nodeId}-${Date.now()}`,
            nodeId,
            eventType: "token",
            content,
            timestamp: new Date().toISOString(),
        });
        // Prevent unbounded buffer growth
        if (this.buffer.length > MAX_BUFFER_SIZE) {
            this.flush();
            return;
        }
        this.scheduleFlush();
    }
    /** Immediately flush on status events */
    emitStatus(nodeId, status, streamId) {
        this.flush(); // Flush any pending tokens first
        this.emit({
            type: "chat:streamChunk",
            streamId: streamId ?? `stream-${nodeId}-${Date.now()}`,
            nodeId,
            eventType: "status",
            content: status,
            timestamp: new Date().toISOString(),
        });
    }
    /** Immediately flush on complete events */
    emitComplete(nodeId, duration, streamId) {
        this.flush();
        this.emit({
            type: "chat:streamComplete",
            streamId: streamId ?? `stream-${nodeId}-${Date.now()}`,
            nodeId,
            finalContent: `Node ${nodeId} completed in ${duration}ms`,
            metadata: { duration },
        });
    }
    /** Immediately flush on error events */
    emitError(nodeId, error, streamId) {
        this.flush();
        this.emit({
            type: "chat:streamChunk",
            streamId: streamId ?? `stream-${nodeId}-${Date.now()}`,
            nodeId,
            eventType: "error",
            content: error,
            timestamp: new Date().toISOString(),
        });
    }
    // === Self-Correction Events (KSA-233) ===
    /** Emit retry event — immediate flush (not buffered) */
    emitRetry(nodeId, attempt, maxAttempts, delayMs, error, streamId) {
        this.flush();
        this.emit({
            type: "chat:streamChunk",
            streamId: streamId ?? `stream-${nodeId}-${Date.now()}`,
            nodeId,
            eventType: "retry",
            content: JSON.stringify({ attempt, maxAttempts, delayMs, error }),
            timestamp: new Date().toISOString(),
        });
    }
    /** Emit verify event — immediate flush */
    emitVerify(nodeId, passed, feedback, attempt, streamId) {
        this.flush();
        this.emit({
            type: "chat:streamChunk",
            streamId: streamId ?? `stream-${nodeId}-${Date.now()}`,
            nodeId,
            eventType: "verify",
            content: JSON.stringify({ passed, feedback, attempt }),
            timestamp: new Date().toISOString(),
        });
    }
    /** Emit strategy switch event — immediate flush */
    emitStrategySwitch(nodeId, fromStrategy, toStrategy, reason, streamId) {
        this.flush();
        this.emit({
            type: "chat:streamChunk",
            streamId: streamId ?? `stream-${nodeId}-${Date.now()}`,
            nodeId,
            eventType: "strategy_switch",
            content: JSON.stringify({ fromStrategy, toStrategy, reason }),
            timestamp: new Date().toISOString(),
        });
    }
    /** Emit human intervention required event — immediate flush */
    emitHumanIntervention(nodeId, failedStrategies, verifyHistory, streamId) {
        this.flush();
        this.emit({
            type: "chat:streamChunk",
            streamId: streamId ?? `stream-${nodeId}-${Date.now()}`,
            nodeId,
            eventType: "human_intervention_required",
            content: JSON.stringify({ failedStrategies, verifyHistory }),
            timestamp: new Date().toISOString(),
        });
    }
    /** Dispose: flush remaining and cancel timer */
    dispose() {
        this.flush();
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
    }
    /** Emit a raw message directly (used for toolCall messages) */
    emitDirect(msg) {
        this.flush();
        this.emit(msg);
    }
    scheduleFlush() {
        if (this.flushTimer) {
            return;
        }
        this.flushTimer = setTimeout(() => this.flush(), this.DEBOUNCE_MS);
    }
    flush() {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        const messages = this.buffer.splice(0);
        for (const msg of messages) {
            this.emit(msg);
        }
    }
}
exports.StreamHandler = StreamHandler;
//# sourceMappingURL=stream-handler.js.map