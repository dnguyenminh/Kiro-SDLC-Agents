"use strict";
/**
 * KbEventEmitter — Server-side event bus for KB changes.
 * Emits events when KB entries are created/updated/deleted, tags changed, scores updated.
 * Consumers (SSE endpoint) subscribe to receive real-time notifications.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.KbEventEmitter = void 0;
const events_1 = require("events");
/**
 * Singleton event emitter for KB changes.
 * MCP tool handlers call emit() when they modify KB state.
 * SSE endpoint subscribes to push events to connected clients.
 */
class KbEventEmitter extends events_1.EventEmitter {
    static instance = null;
    static getInstance() {
        if (!KbEventEmitter.instance) {
            KbEventEmitter.instance = new KbEventEmitter();
        }
        return KbEventEmitter.instance;
    }
    /** Emit a KB change event to all subscribers. */
    emitKbEvent(type, data = {}) {
        const event = { type, timestamp: Date.now(), data };
        this.emit('kb_change', event);
    }
    /** Subscribe to KB change events. Returns unsubscribe function. */
    subscribe(handler) {
        this.on('kb_change', handler);
        return () => this.off('kb_change', handler);
    }
}
exports.KbEventEmitter = KbEventEmitter;
//# sourceMappingURL=kb-event-emitter.js.map