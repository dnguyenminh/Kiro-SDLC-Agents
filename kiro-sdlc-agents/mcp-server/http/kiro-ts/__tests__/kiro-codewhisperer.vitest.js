"use strict";
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
/**
 * kiro-ts CodeWhisperer Integration Tests — KSA-237
 *
 * Covers the bug-fix modules that target q.{region}.amazonaws.com/generateAssistantResponse:
 *  - kiro-converter   (Anthropic → conversationState)
 *  - event-stream-parser (AWS Event Stream binary frame parsing)
 *  - kiro-stream      (Kiro events → Anthropic SSE)
 *  - machine-id       (stable 64-hex machine id)
 */
const vitest_1 = require("vitest");
const fc = __importStar(require("fast-check"));
const kiro_converter_js_1 = require("../kiro-converter.js");
const event_stream_parser_js_1 = require("../event-stream-parser.js");
const kiro_stream_js_1 = require("../kiro-stream.js");
const machine_id_js_1 = require("../machine-id.js");
// ---------------------------------------------------------------------------
// Helpers to build a synthetic AWS Event Stream frame
// ---------------------------------------------------------------------------
function encodeStringHeader(name, value) {
    const nameBuf = Buffer.from(name, 'utf8');
    const valueBuf = Buffer.from(value, 'utf8');
    const buf = Buffer.alloc(1 + nameBuf.length + 1 + 2 + valueBuf.length);
    let o = 0;
    buf.writeUInt8(nameBuf.length, o);
    o += 1;
    nameBuf.copy(buf, o);
    o += nameBuf.length;
    buf.writeUInt8(7, o);
    o += 1; // type 7 = String
    buf.writeUInt16BE(valueBuf.length, o);
    o += 2;
    valueBuf.copy(buf, o);
    return buf;
}
/** Build a complete event-stream frame for an `event` message. */
function buildFrame(eventType, payload) {
    const headers = Buffer.concat([
        encodeStringHeader(':message-type', 'event'),
        encodeStringHeader(':event-type', eventType),
        encodeStringHeader(':content-type', 'application/json'),
    ]);
    const payloadBuf = Buffer.from(JSON.stringify(payload), 'utf8');
    const totalLength = 12 + headers.length + payloadBuf.length + 4;
    const buf = Buffer.alloc(totalLength);
    buf.writeUInt32BE(totalLength, 0);
    buf.writeUInt32BE(headers.length, 4);
    const preludeCrc = (0, event_stream_parser_js_1.crc32)(buf, 0, 8);
    buf.writeUInt32BE(preludeCrc, 8);
    headers.copy(buf, 12);
    payloadBuf.copy(buf, 12 + headers.length);
    const messageCrc = (0, event_stream_parser_js_1.crc32)(buf, 0, totalLength - 4);
    buf.writeUInt32BE(messageCrc, totalLength - 4);
    return buf;
}
// ===========================================================================
// Model mapping
// ===========================================================================
(0, vitest_1.describe)('kiro-converter: mapModel', () => {
    (0, vitest_1.it)('maps sonnet/opus/haiku families', () => {
        (0, vitest_1.expect)((0, kiro_converter_js_1.mapModel)('claude-sonnet-4-20250514')).toContain('sonnet');
        (0, vitest_1.expect)((0, kiro_converter_js_1.mapModel)('Claude Haiku 4.5')).toBe('claude-haiku-4.5');
        (0, vitest_1.expect)((0, kiro_converter_js_1.mapModel)('claude-opus-4-5')).toBe('claude-opus-4.5');
        (0, vitest_1.expect)((0, kiro_converter_js_1.mapModel)('claude-opus-4-8')).toBe('claude-opus-4.8');
        (0, vitest_1.expect)((0, kiro_converter_js_1.mapModel)('claude-sonnet-4-6')).toBe('claude-sonnet-4.6');
    });
    (0, vitest_1.it)('returns null for unknown families', () => {
        (0, vitest_1.expect)((0, kiro_converter_js_1.mapModel)('gpt-4o')).toBeNull();
    });
});
// ===========================================================================
// Request conversion
// ===========================================================================
(0, vitest_1.describe)('kiro-converter: convertRequest', () => {
    (0, vitest_1.it)('builds conversationState with MANUAL trigger and vibe task', () => {
        const req = {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            messages: [{ role: 'user', content: 'Hello there' }],
        };
        const { conversationState } = (0, kiro_converter_js_1.convertRequest)(req);
        (0, vitest_1.expect)(conversationState.chatTriggerType).toBe('MANUAL');
        (0, vitest_1.expect)(conversationState.agentTaskType).toBe('vibe');
        (0, vitest_1.expect)(conversationState.currentMessage.userInputMessage.content).toBe('Hello there');
        (0, vitest_1.expect)(conversationState.currentMessage.userInputMessage.modelId).toBe('claude-sonnet-4.5');
        (0, vitest_1.expect)(conversationState.currentMessage.userInputMessage.origin).toBe('AI_EDITOR');
    });
    (0, vitest_1.it)('turns system prompt into a User/Assistant policy pair', () => {
        const req = {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: 'You are a helpful assistant',
            messages: [{ role: 'user', content: 'Hi' }],
        };
        const { conversationState } = (0, kiro_converter_js_1.convertRequest)(req);
        const h = conversationState.history;
        (0, vitest_1.expect)(h.length).toBeGreaterThanOrEqual(2);
        (0, vitest_1.expect)(h[0].userInputMessage.content).toBe('You are a helpful assistant');
        (0, vitest_1.expect)(h[1].assistantResponseMessage.content).toBe('I will follow these instructions.');
    });
    (0, vitest_1.it)('rejects unsupported models', () => {
        const req = {
            model: 'gpt-4o',
            max_tokens: 1024,
            messages: [{ role: 'user', content: 'Hi' }],
        };
        (0, vitest_1.expect)(() => (0, kiro_converter_js_1.convertRequest)(req)).toThrow(kiro_converter_js_1.ConversionError);
    });
    (0, vitest_1.it)('pairs tool_use in history with tool_result in current message', () => {
        const req = {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            tools: [{ name: 'get_file', description: 'Read', input_schema: { type: 'object' } }],
            messages: [
                { role: 'user', content: 'read file' },
                { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name: 'get_file', input: { path: '/x' } }] },
                { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'file body' }] },
            ],
        };
        const { conversationState } = (0, kiro_converter_js_1.convertRequest)(req);
        const ctx = conversationState.currentMessage.userInputMessage.userInputMessageContext;
        (0, vitest_1.expect)(ctx.toolResults).toBeDefined();
        (0, vitest_1.expect)(ctx.toolResults[0].toolUseId).toBe('toolu_1');
        (0, vitest_1.expect)(ctx.toolResults[0].content[0].text).toBe('file body');
    });
});
// ===========================================================================
// Event Stream parser
// ===========================================================================
(0, vitest_1.describe)('event-stream-parser: CRC32', () => {
    (0, vitest_1.it)('matches the known ISO-HDLC test vector for "123456789"', () => {
        (0, vitest_1.expect)((0, event_stream_parser_js_1.crc32)(Buffer.from('123456789'))).toBe(0xcbf43926);
    });
    (0, vitest_1.it)('empty buffer is 0', () => {
        (0, vitest_1.expect)((0, event_stream_parser_js_1.crc32)(Buffer.alloc(0))).toBe(0);
    });
});
(0, vitest_1.describe)('event-stream-parser: parseFrame', () => {
    (0, vitest_1.it)('parses an assistantResponseEvent frame', () => {
        const frame = buildFrame('assistantResponseEvent', { content: 'Hello' });
        const result = (0, event_stream_parser_js_1.parseFrame)(frame);
        (0, vitest_1.expect)(result).not.toBeNull();
        (0, vitest_1.expect)(result.consumed).toBe(frame.length);
        (0, vitest_1.expect)(result.frame.headers[':event-type']).toBe('assistantResponseEvent');
        (0, vitest_1.expect)(JSON.parse(result.frame.payload.toString('utf8')).content).toBe('Hello');
    });
    (0, vitest_1.it)('returns null when buffer is incomplete', () => {
        const frame = buildFrame('assistantResponseEvent', { content: 'Hello' });
        (0, vitest_1.expect)((0, event_stream_parser_js_1.parseFrame)(frame.subarray(0, 8))).toBeNull();
        (0, vitest_1.expect)((0, event_stream_parser_js_1.parseFrame)(frame.subarray(0, frame.length - 2))).toBeNull();
    });
    (0, vitest_1.it)('decoder yields frames split across chunk boundaries', () => {
        const f1 = buildFrame('assistantResponseEvent', { content: 'Hel' });
        const f2 = buildFrame('assistantResponseEvent', { content: 'lo' });
        const combined = Buffer.concat([f1, f2]);
        const decoder = new event_stream_parser_js_1.EventStreamDecoder();
        const out = [];
        // Feed byte-by-byte to exercise partial buffering
        for (let i = 0; i < combined.length; i++) {
            decoder.feed(combined.subarray(i, i + 1));
            out.push(...decoder.decodeAll());
        }
        (0, vitest_1.expect)(out.length).toBe(2);
        (0, vitest_1.expect)(JSON.parse(out[0].payload.toString()).content).toBe('Hel');
        (0, vitest_1.expect)(JSON.parse(out[1].payload.toString()).content).toBe('lo');
    });
});
// ===========================================================================
// Kiro stream → Anthropic SSE
// ===========================================================================
(0, vitest_1.describe)('kiro-stream: KiroStreamConverter', () => {
    (0, vitest_1.it)('produces a valid Anthropic SSE sequence for text', () => {
        const conv = new kiro_stream_js_1.KiroStreamConverter('claude-sonnet-4-20250514');
        const events = [
            ...conv.start(),
            ...conv.processFrame((0, event_stream_parser_js_1.parseFrame)(buildFrame('assistantResponseEvent', { content: 'Hello ' })).frame),
            ...conv.processFrame((0, event_stream_parser_js_1.parseFrame)(buildFrame('assistantResponseEvent', { content: 'world' })).frame),
            ...conv.finish(),
        ];
        const types = events.map((e) => e.event);
        (0, vitest_1.expect)(types[0]).toBe('message_start');
        (0, vitest_1.expect)(types).toContain('content_block_start');
        (0, vitest_1.expect)(types).toContain('content_block_delta');
        (0, vitest_1.expect)(types).toContain('content_block_stop');
        (0, vitest_1.expect)(types).toContain('message_delta');
        (0, vitest_1.expect)(types[types.length - 1]).toBe('message_stop');
        // Reconstruct text
        const text = events
            .filter((e) => e.event === 'content_block_delta')
            .map((e) => e.data.delta.text)
            .join('');
        (0, vitest_1.expect)(text).toBe('Hello world');
    });
    (0, vitest_1.it)('emits tool_use blocks with passthrough id and input_json_delta', () => {
        const conv = new kiro_stream_js_1.KiroStreamConverter('claude-sonnet-4-20250514');
        const events = [
            ...conv.start(),
            ...conv.processFrame((0, event_stream_parser_js_1.parseFrame)(buildFrame('toolUseEvent', { name: 'get_file', toolUseId: 'toolu_99', input: '{"path":"/x"}', stop: true })).frame),
            ...conv.finish(),
        ];
        const start = events.find((e) => e.event === 'content_block_start');
        (0, vitest_1.expect)(start.data.content_block.type).toBe('tool_use');
        (0, vitest_1.expect)(start.data.content_block.id).toBe('toolu_99');
        const delta = events.find((e) => e.event === 'content_block_delta');
        (0, vitest_1.expect)(delta.data.delta.type).toBe('input_json_delta');
        const msgDelta = events.find((e) => e.event === 'message_delta');
        (0, vitest_1.expect)(msgDelta.data.delta.stop_reason).toBe('tool_use');
    });
});
// ===========================================================================
// Machine ID
// ===========================================================================
(0, vitest_1.describe)('machine-id', () => {
    (0, vitest_1.it)('normalizes 64-hex and UUID forms', () => {
        const hex64 = 'a'.repeat(64);
        (0, vitest_1.expect)((0, machine_id_js_1.normalizeMachineId)(hex64)).toBe(hex64);
        const uuid = '2582956e-cc88-4669-b546-07adbffcb894';
        const norm = (0, machine_id_js_1.normalizeMachineId)(uuid);
        (0, vitest_1.expect)(norm).toBe('2582956ecc884669b54607adbffcb8942582956ecc884669b54607adbffcb894');
        (0, vitest_1.expect)((0, machine_id_js_1.normalizeMachineId)('not-a-machine-id')).toBeNull();
    });
    (0, vitest_1.it)('derives a stable 64-hex id from a seed', () => {
        const a = (0, machine_id_js_1.deriveMachineId)('refresh-token-abc');
        const b = (0, machine_id_js_1.deriveMachineId)('refresh-token-abc');
        (0, vitest_1.expect)(a).toBe(b);
        (0, vitest_1.expect)(a).toMatch(/^[0-9a-f]{64}$/);
    });
    (0, vitest_1.it)('resolveMachineId is stable for the same seed', () => {
        fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 64 }), (seed) => {
            (0, vitest_1.expect)((0, machine_id_js_1.resolveMachineId)({ seed })).toBe((0, machine_id_js_1.resolveMachineId)({ seed }));
        }), { numRuns: 25 });
    });
});
//# sourceMappingURL=kiro-codewhisperer.vitest.js.map