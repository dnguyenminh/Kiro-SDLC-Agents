/**
 * kiro-ts CodeWhisperer Integration Tests — KSA-237
 *
 * Covers the bug-fix modules that target q.{region}.amazonaws.com/generateAssistantResponse:
 *  - kiro-converter   (Anthropic → conversationState)
 *  - event-stream-parser (AWS Event Stream binary frame parsing)
 *  - kiro-stream      (Kiro events → Anthropic SSE)
 *  - machine-id       (stable 64-hex machine id)
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { convertRequest, mapModel, ConversionError } from '../kiro-converter.js';
import { crc32, parseFrame, EventStreamDecoder, Frame } from '../event-stream-parser.js';
import { KiroStreamConverter } from '../kiro-stream.js';
import { normalizeMachineId, deriveMachineId, resolveMachineId } from '../machine-id.js';
import { AnthropicRequest } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers to build a synthetic AWS Event Stream frame
// ---------------------------------------------------------------------------

function encodeStringHeader(name: string, value: string): Buffer {
  const nameBuf = Buffer.from(name, 'utf8');
  const valueBuf = Buffer.from(value, 'utf8');
  const buf = Buffer.alloc(1 + nameBuf.length + 1 + 2 + valueBuf.length);
  let o = 0;
  buf.writeUInt8(nameBuf.length, o); o += 1;
  nameBuf.copy(buf, o); o += nameBuf.length;
  buf.writeUInt8(7, o); o += 1; // type 7 = String
  buf.writeUInt16BE(valueBuf.length, o); o += 2;
  valueBuf.copy(buf, o);
  return buf;
}

/** Build a complete event-stream frame for an `event` message. */
function buildFrame(eventType: string, payload: object): Buffer {
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
  const preludeCrc = crc32(buf, 0, 8);
  buf.writeUInt32BE(preludeCrc, 8);
  headers.copy(buf, 12);
  payloadBuf.copy(buf, 12 + headers.length);
  const messageCrc = crc32(buf, 0, totalLength - 4);
  buf.writeUInt32BE(messageCrc, totalLength - 4);
  return buf;
}

// ===========================================================================
// Model mapping
// ===========================================================================
describe('kiro-converter: mapModel', () => {
  it('maps sonnet/opus/haiku families', () => {
    expect(mapModel('claude-sonnet-4-20250514')).toContain('sonnet');
    expect(mapModel('Claude Haiku 4.5')).toBe('claude-haiku-4.5');
    expect(mapModel('claude-opus-4-5')).toBe('claude-opus-4.5');
    expect(mapModel('claude-opus-4-8')).toBe('claude-opus-4.8');
    expect(mapModel('claude-sonnet-4-6')).toBe('claude-sonnet-4.6');
  });

  it('returns null for unknown families', () => {
    expect(mapModel('gpt-4o')).toBeNull();
  });
});

// ===========================================================================
// Request conversion
// ===========================================================================
describe('kiro-converter: convertRequest', () => {
  it('builds conversationState with MANUAL trigger and vibe task', () => {
    const req: AnthropicRequest = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Hello there' }],
    };
    const { conversationState } = convertRequest(req);
    expect(conversationState.chatTriggerType).toBe('MANUAL');
    expect(conversationState.agentTaskType).toBe('vibe');
    expect(conversationState.currentMessage.userInputMessage.content).toBe('Hello there');
    expect(conversationState.currentMessage.userInputMessage.modelId).toBe('claude-sonnet-4.5');
    expect(conversationState.currentMessage.userInputMessage.origin).toBe('AI_EDITOR');
  });

  it('turns system prompt into a User/Assistant policy pair', () => {
    const req: AnthropicRequest = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'You are a helpful assistant',
      messages: [{ role: 'user', content: 'Hi' }],
    };
    const { conversationState } = convertRequest(req);
    const h = conversationState.history;
    expect(h.length).toBeGreaterThanOrEqual(2);
    expect((h[0] as any).userInputMessage.content).toBe('You are a helpful assistant');
    expect((h[1] as any).assistantResponseMessage.content).toBe('I will follow these instructions.');
  });

  it('rejects unsupported models', () => {
    const req: AnthropicRequest = {
      model: 'gpt-4o',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Hi' }],
    };
    expect(() => convertRequest(req)).toThrow(ConversionError);
  });

  it('pairs tool_use in history with tool_result in current message', () => {
    const req: AnthropicRequest = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      tools: [{ name: 'get_file', description: 'Read', input_schema: { type: 'object' } }],
      messages: [
        { role: 'user', content: 'read file' },
        { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name: 'get_file', input: { path: '/x' } }] },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'file body' } as any] },
      ],
    };
    const { conversationState } = convertRequest(req);
    const ctx = conversationState.currentMessage.userInputMessage.userInputMessageContext;
    expect(ctx.toolResults).toBeDefined();
    expect(ctx.toolResults![0].toolUseId).toBe('toolu_1');
    expect(ctx.toolResults![0].content[0].text).toBe('file body');
  });
});

// ===========================================================================
// Event Stream parser
// ===========================================================================
describe('event-stream-parser: CRC32', () => {
  it('matches the known ISO-HDLC test vector for "123456789"', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
  });
  it('empty buffer is 0', () => {
    expect(crc32(Buffer.alloc(0))).toBe(0);
  });
});

describe('event-stream-parser: parseFrame', () => {
  it('parses an assistantResponseEvent frame', () => {
    const frame = buildFrame('assistantResponseEvent', { content: 'Hello' });
    const result = parseFrame(frame);
    expect(result).not.toBeNull();
    expect(result!.consumed).toBe(frame.length);
    expect(result!.frame.headers[':event-type']).toBe('assistantResponseEvent');
    expect(JSON.parse(result!.frame.payload.toString('utf8')).content).toBe('Hello');
  });

  it('returns null when buffer is incomplete', () => {
    const frame = buildFrame('assistantResponseEvent', { content: 'Hello' });
    expect(parseFrame(frame.subarray(0, 8))).toBeNull();
    expect(parseFrame(frame.subarray(0, frame.length - 2))).toBeNull();
  });

  it('decoder yields frames split across chunk boundaries', () => {
    const f1 = buildFrame('assistantResponseEvent', { content: 'Hel' });
    const f2 = buildFrame('assistantResponseEvent', { content: 'lo' });
    const combined = Buffer.concat([f1, f2]);

    const decoder = new EventStreamDecoder();
    const out: Frame[] = [];
    // Feed byte-by-byte to exercise partial buffering
    for (let i = 0; i < combined.length; i++) {
      decoder.feed(combined.subarray(i, i + 1));
      out.push(...decoder.decodeAll());
    }
    expect(out.length).toBe(2);
    expect(JSON.parse(out[0].payload.toString()).content).toBe('Hel');
    expect(JSON.parse(out[1].payload.toString()).content).toBe('lo');
  });
});

// ===========================================================================
// Kiro stream → Anthropic SSE
// ===========================================================================
describe('kiro-stream: KiroStreamConverter', () => {
  it('produces a valid Anthropic SSE sequence for text', () => {
    const conv = new KiroStreamConverter('claude-sonnet-4-20250514');
    const events = [
      ...conv.start(),
      ...conv.processFrame(parseFrame(buildFrame('assistantResponseEvent', { content: 'Hello ' }))!.frame),
      ...conv.processFrame(parseFrame(buildFrame('assistantResponseEvent', { content: 'world' }))!.frame),
      ...conv.finish(),
    ];
    const types = events.map((e) => e.event);
    expect(types[0]).toBe('message_start');
    expect(types).toContain('content_block_start');
    expect(types).toContain('content_block_delta');
    expect(types).toContain('content_block_stop');
    expect(types).toContain('message_delta');
    expect(types[types.length - 1]).toBe('message_stop');

    // Reconstruct text
    const text = events
      .filter((e) => e.event === 'content_block_delta')
      .map((e) => (e.data as any).delta.text)
      .join('');
    expect(text).toBe('Hello world');
  });

  it('emits tool_use blocks with passthrough id and input_json_delta', () => {
    const conv = new KiroStreamConverter('claude-sonnet-4-20250514');
    const events = [
      ...conv.start(),
      ...conv.processFrame(
        parseFrame(buildFrame('toolUseEvent', { name: 'get_file', toolUseId: 'toolu_99', input: '{"path":"/x"}', stop: true }))!.frame,
      ),
      ...conv.finish(),
    ];
    const start = events.find((e) => e.event === 'content_block_start');
    expect((start!.data as any).content_block.type).toBe('tool_use');
    expect((start!.data as any).content_block.id).toBe('toolu_99');
    const delta = events.find((e) => e.event === 'content_block_delta');
    expect((delta!.data as any).delta.type).toBe('input_json_delta');
    const msgDelta = events.find((e) => e.event === 'message_delta');
    expect((msgDelta!.data as any).delta.stop_reason).toBe('tool_use');
  });
});

// ===========================================================================
// Machine ID
// ===========================================================================
describe('machine-id', () => {
  it('normalizes 64-hex and UUID forms', () => {
    const hex64 = 'a'.repeat(64);
    expect(normalizeMachineId(hex64)).toBe(hex64);
    const uuid = '2582956e-cc88-4669-b546-07adbffcb894';
    const norm = normalizeMachineId(uuid);
    expect(norm).toBe('2582956ecc884669b54607adbffcb8942582956ecc884669b54607adbffcb894');
    expect(normalizeMachineId('not-a-machine-id')).toBeNull();
  });

  it('derives a stable 64-hex id from a seed', () => {
    const a = deriveMachineId('refresh-token-abc');
    const b = deriveMachineId('refresh-token-abc');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('resolveMachineId is stable for the same seed', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 64 }), (seed) => {
        expect(resolveMachineId({ seed })).toBe(resolveMachineId({ seed }));
      }),
      { numRuns: 25 },
    );
  });
});
