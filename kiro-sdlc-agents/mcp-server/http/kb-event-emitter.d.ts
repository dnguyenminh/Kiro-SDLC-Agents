/**
 * KbEventEmitter — Server-side event bus for KB changes.
 * Emits events when KB entries are created/updated/deleted, tags changed, scores updated.
 * Consumers (SSE endpoint) subscribe to receive real-time notifications.
 */
import { EventEmitter } from 'events';
export type KbEventType = 'kb_entry_added' | 'kb_entry_updated' | 'kb_entry_deleted' | 'tag_created' | 'tag_deleted' | 'tag_updated' | 'quality_scored' | 'bulk_operation' | 'consolidation_complete';
export interface KbEvent {
    type: KbEventType;
    timestamp: number;
    data: Record<string, unknown>;
}
/**
 * Singleton event emitter for KB changes.
 * MCP tool handlers call emit() when they modify KB state.
 * SSE endpoint subscribes to push events to connected clients.
 */
export declare class KbEventEmitter extends EventEmitter {
    private static instance;
    static getInstance(): KbEventEmitter;
    /** Emit a KB change event to all subscribers. */
    emitKbEvent(type: KbEventType, data?: Record<string, unknown>): void;
    /** Subscribe to KB change events. Returns unsubscribe function. */
    subscribe(handler: (event: KbEvent) => void): () => void;
}
//# sourceMappingURL=kb-event-emitter.d.ts.map