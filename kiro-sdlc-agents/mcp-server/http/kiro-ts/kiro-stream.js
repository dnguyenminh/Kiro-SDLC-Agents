"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.KiroStreamConverter = void 0;
const crypto = __importStar(require("crypto"));
const event_stream_parser_js_1 = require("./event-stream-parser.js");
/**
 * Stateful converter that turns Kiro frames into ordered Anthropic SSE events.
 * Mirrors the SseStateManager invariants from kiro.rs (single message_start,
 * proper block start/delta/stop ordering, single message_delta, final message_stop).
 */
class KiroStreamConverter {
    messageId;
    model;
    messageStarted = false;
    messageEnded = false;
    nextIndex = 0;
    currentTextBlock = null;
    currentToolBlock = null;
    outputTokens = 0;
    stopReason = 'end_turn';
    constructor(model, messageId) {
        this.model = model;
        this.messageId = messageId || `msg_${crypto.randomBytes(12).toString('hex')}`;
    }
    /** Produce the initial message_start event. Call once before processing frames. */
    start() {
        if (this.messageStarted)
            return [];
        this.messageStarted = true;
        return [
            {
                event: 'message_start',
                data: {
                    type: 'message_start',
                    message: {
                        id: this.messageId,
                        type: 'message',
                        role: 'assistant',
                        model: this.model,
                        content: [],
                        stop_reason: null,
                        stop_sequence: null,
                        usage: { input_tokens: 0, output_tokens: 0 },
                    },
                },
            },
        ];
    }
    /** Process a single parsed frame, returning any SSE events to forward. */
    processFrame(frame) {
        const mType = (0, event_stream_parser_js_1.messageType)(frame) || 'event';
        if (mType === 'exception') {
            return this.handleException((0, event_stream_parser_js_1.exceptionType)(frame) || 'UnknownException', frame.payload.toString('utf8'));
        }
        if (mType === 'error') {
            // Surface as an error SSE event
            const code = (0, event_stream_parser_js_1.errorCode)(frame) || 'UnknownError';
            return [
                {
                    event: 'error',
                    data: { type: 'error', error: { type: 'api_error', message: `${code}: ${frame.payload.toString('utf8')}` } },
                },
            ];
        }
        const eType = (0, event_stream_parser_js_1.eventType)(frame) || 'unknown';
        let payload;
        try {
            payload = JSON.parse(frame.payload.toString('utf8'));
        }
        catch {
            return [];
        }
        switch (eType) {
            case 'assistantResponseEvent':
                return this.handleAssistantResponse(typeof payload.content === 'string' ? payload.content : '');
            case 'toolUseEvent':
                return this.handleToolUse(payload);
            case 'contextUsageEvent':
                // Used for token accounting only — no SSE output
                return [];
            default:
                return [];
        }
    }
    /** Produce the final message_delta + message_stop events. Call once at stream end. */
    finish() {
        const events = [];
        // Close any open blocks
        events.push(...this.closeOpenBlocks());
        events.push({
            event: 'message_delta',
            data: {
                type: 'message_delta',
                delta: { stop_reason: this.stopReason, stop_sequence: null },
                usage: { output_tokens: this.outputTokens },
            },
        });
        if (!this.messageEnded) {
            this.messageEnded = true;
            events.push({ event: 'message_stop', data: { type: 'message_stop' } });
        }
        return events;
    }
    // -------------------------------------------------------------------------
    handleAssistantResponse(content) {
        if (!content)
            return [];
        const events = [];
        this.outputTokens += estimateTokens(content);
        // A tool block may be open; close it before emitting text.
        if (this.currentToolBlock) {
            events.push(...this.closeToolBlock());
        }
        if (!this.currentTextBlock) {
            const index = this.nextIndex++;
            this.currentTextBlock = { index, type: 'text' };
            events.push({
                event: 'content_block_start',
                data: { type: 'content_block_start', index, content_block: { type: 'text', text: '' } },
            });
        }
        events.push({
            event: 'content_block_delta',
            data: {
                type: 'content_block_delta',
                index: this.currentTextBlock.index,
                delta: { type: 'text_delta', text: content },
            },
        });
        return events;
    }
    handleToolUse(payload) {
        const events = [];
        const name = typeof payload.name === 'string' ? payload.name : '';
        const toolUseId = typeof payload.toolUseId === 'string' ? payload.toolUseId : '';
        const input = typeof payload.input === 'string' ? payload.input : '';
        const stop = payload.stop === true;
        // Close any open text block before starting/continuing a tool block.
        if (this.currentTextBlock) {
            events.push(...this.closeTextBlock());
        }
        if (!this.currentToolBlock) {
            const index = this.nextIndex++;
            this.currentToolBlock = { index, type: 'tool_use' };
            this.stopReason = 'tool_use';
            events.push({
                event: 'content_block_start',
                data: {
                    type: 'content_block_start',
                    index,
                    content_block: { type: 'tool_use', id: toolUseId, name, input: {} },
                },
            });
        }
        if (input.length > 0) {
            this.outputTokens += Math.ceil(input.length / 4);
            events.push({
                event: 'content_block_delta',
                data: {
                    type: 'content_block_delta',
                    index: this.currentToolBlock.index,
                    delta: { type: 'input_json_delta', partial_json: input },
                },
            });
        }
        if (stop) {
            events.push(...this.closeToolBlock());
        }
        return events;
    }
    handleException(exType, message) {
        if (exType === 'ContentLengthExceededException') {
            this.stopReason = 'max_tokens';
            return [];
        }
        return [
            {
                event: 'error',
                data: { type: 'error', error: { type: 'api_error', message: `${exType}: ${message}` } },
            },
        ];
    }
    closeTextBlock() {
        if (!this.currentTextBlock)
            return [];
        const index = this.currentTextBlock.index;
        this.currentTextBlock = null;
        return [{ event: 'content_block_stop', data: { type: 'content_block_stop', index } }];
    }
    closeToolBlock() {
        if (!this.currentToolBlock)
            return [];
        const index = this.currentToolBlock.index;
        this.currentToolBlock = null;
        return [{ event: 'content_block_stop', data: { type: 'content_block_stop', index } }];
    }
    closeOpenBlocks() {
        const events = [];
        events.push(...this.closeTextBlock());
        events.push(...this.closeToolBlock());
        return events;
    }
}
exports.KiroStreamConverter = KiroStreamConverter;
/** Rough token estimate (~4 chars/token), matching kiro.rs heuristic. */
function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}
//# sourceMappingURL=kiro-stream.js.map