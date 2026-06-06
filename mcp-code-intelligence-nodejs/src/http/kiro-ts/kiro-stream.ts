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

import * as crypto from 'crypto';
import { Frame, eventType, messageType, exceptionType, errorCode } from './event-stream-parser.js';

export interface SseEvent {
  event: string;
  data: unknown;
}

interface ActiveBlock {
  index: number;
  type: 'text' | 'tool_use';
}

/**
 * Stateful converter that turns Kiro frames into ordered Anthropic SSE events.
 * Mirrors the SseStateManager invariants from kiro.rs (single message_start,
 * proper block start/delta/stop ordering, single message_delta, final message_stop).
 */
export class KiroStreamConverter {
  private readonly messageId: string;
  private readonly model: string;

  private messageStarted = false;
  private messageEnded = false;
  private nextIndex = 0;

  private currentTextBlock: ActiveBlock | null = null;
  private currentToolBlock: ActiveBlock | null = null;

  private outputTokens = 0;
  private stopReason: string = 'end_turn';

  constructor(model: string, messageId?: string) {
    this.model = model;
    this.messageId = messageId || `msg_${crypto.randomBytes(12).toString('hex')}`;
  }

  /** Produce the initial message_start event. Call once before processing frames. */
  start(): SseEvent[] {
    if (this.messageStarted) return [];
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
  processFrame(frame: Frame): SseEvent[] {
    const mType = messageType(frame) || 'event';

    if (mType === 'exception') {
      return this.handleException(exceptionType(frame) || 'UnknownException', frame.payload.toString('utf8'));
    }
    if (mType === 'error') {
      // Surface as an error SSE event
      const code = errorCode(frame) || 'UnknownError';
      return [
        {
          event: 'error',
          data: { type: 'error', error: { type: 'api_error', message: `${code}: ${frame.payload.toString('utf8')}` } },
        },
      ];
    }

    const eType = eventType(frame) || 'unknown';
    let payload: any;
    try {
      payload = JSON.parse(frame.payload.toString('utf8'));
    } catch {
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
  finish(): SseEvent[] {
    const events: SseEvent[] = [];

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

  private handleAssistantResponse(content: string): SseEvent[] {
    if (!content) return [];
    const events: SseEvent[] = [];
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

  private handleToolUse(payload: any): SseEvent[] {
    const events: SseEvent[] = [];
    const name: string = typeof payload.name === 'string' ? payload.name : '';
    const toolUseId: string = typeof payload.toolUseId === 'string' ? payload.toolUseId : '';
    const input: string = typeof payload.input === 'string' ? payload.input : '';
    const stop: boolean = payload.stop === true;

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

  private handleException(exType: string, message: string): SseEvent[] {
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

  private closeTextBlock(): SseEvent[] {
    if (!this.currentTextBlock) return [];
    const index = this.currentTextBlock.index;
    this.currentTextBlock = null;
    return [{ event: 'content_block_stop', data: { type: 'content_block_stop', index } }];
  }

  private closeToolBlock(): SseEvent[] {
    if (!this.currentToolBlock) return [];
    const index = this.currentToolBlock.index;
    this.currentToolBlock = null;
    return [{ event: 'content_block_stop', data: { type: 'content_block_stop', index } }];
  }

  private closeOpenBlocks(): SseEvent[] {
    const events: SseEvent[] = [];
    events.push(...this.closeTextBlock());
    events.push(...this.closeToolBlock());
    return events;
  }
}

/** Rough token estimate (~4 chars/token), matching kiro.rs heuristic. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
