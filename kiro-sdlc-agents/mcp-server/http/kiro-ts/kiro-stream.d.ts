/**
 * Kiro Stream — KSA-237
 *
 * Converts parsed Kiro AWS Event Stream frames into Anthropic SSE events.
 * Ported (simplified) from kiro.rs `src/anthropic/stream.rs`.
 *
 * Kiro event payloads (JSON):
 *   - assistantResponseEvent: { content: string }
 *   - toolUseEvent:           { name, toolUseId, input: string(partial JSON), stop: bool }
 *   - contextUsageEvent:      { contextUsagePercentage: number }
 *
 * Anthropic SSE sequence produced:
 *   message_start → (content_block_start → content_block_delta* → content_block_stop)* →
 *   message_delta → message_stop
 */
import { Frame } from './event-stream-parser.js';
export interface SseEvent {
    event: string;
    data: unknown;
}
/**
 * Stateful converter that turns Kiro frames into ordered Anthropic SSE events.
 * Mirrors the SseStateManager invariants from kiro.rs (single message_start,
 * proper block start/delta/stop ordering, single message_delta, final message_stop).
 */
export declare class KiroStreamConverter {
    private readonly messageId;
    private readonly model;
    private messageStarted;
    private messageEnded;
    private nextIndex;
    private currentTextBlock;
    private currentToolBlock;
    private outputTokens;
    private stopReason;
    constructor(model: string, messageId?: string);
    /** Produce the initial message_start event. Call once before processing frames. */
    start(): SseEvent[];
    /** Process a single parsed frame, returning any SSE events to forward. */
    processFrame(frame: Frame): SseEvent[];
    /** Produce the final message_delta + message_stop events. Call once at stream end. */
    finish(): SseEvent[];
    private handleAssistantResponse;
    private handleToolUse;
    private handleException;
    private closeTextBlock;
    private closeToolBlock;
    private closeOpenBlocks;
}
//# sourceMappingURL=kiro-stream.d.ts.map