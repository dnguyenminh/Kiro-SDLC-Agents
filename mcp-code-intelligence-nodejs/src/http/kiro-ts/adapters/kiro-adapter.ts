/**
 * Kiro Adapter — KSA-237 (Adapter Pattern)
 *
 * Implements LLMBackendAdapter for the Kiro SSO -> CodeWhisperer backend.
 * Encapsulates all the logic previously inline in chat-handler's kiro mode:
 *   - convert Anthropic request -> CodeWhisperer conversationState
 *   - call generateAssistantResponse with KiroIDE headers + bearer token
 *   - parse the binary AWS Event Stream response
 *   - convert frames back to Anthropic SSE (stream) or aggregate to JSON
 *
 * `listModels` is the source of truth for the Kiro model list (Settings panel
 * AVAILABLE_MODELS.kiro must mirror these ids).
 */

import * as http from 'http';
import * as https from 'https';
import * as os from 'os';
import * as crypto from 'crypto';
import { AnthropicRequest, AuthResult, ContentBlock } from '../types.js';
import { resolveApiRegionAsync } from '../auth-resolver.js';
import { convertRequest, ConversionError } from '../kiro-converter.js';
import { EventStreamDecoder } from '../event-stream-parser.js';
import { KiroStreamConverter, SseEvent } from '../kiro-stream.js';
import { resolveMachineId } from '../machine-id.js';
import { KIRO_VERSION, NODE_VERSION } from '../kiro-config.js';
import { fetchKiroModels } from '../kiro-models-client.js';
import { writeSSEHeaders, formatSSEEvent } from '../stream-proxy.js';
import { LLMBackendAdapter, AnthropicModel } from './llm-backend-adapter.js';
import { sendError } from './adapter-utils.js';

/**
 * Canonical list of Kiro-supported models. Each maps (via kiro-converter
 * `mapModel`) to a Kiro model family. These ids MUST contain the family
 * keyword (sonnet/opus/haiku) and version so mapModel resolves correctly.
 *
 * This is the SINGLE SOURCE OF TRUTH for the Kiro model list — the Settings
 * panel AVAILABLE_MODELS.kiro must mirror these ids.
 */
export const KIRO_MODELS: AnthropicModel[] = [
  { type: 'model', id: 'claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5' },
  { type: 'model', id: 'claude-sonnet-4-6', display_name: 'Claude Sonnet 4.6' },
  { type: 'model', id: 'claude-opus-4-5', display_name: 'Claude Opus 4.5' },
  { type: 'model', id: 'claude-opus-4-6', display_name: 'Claude Opus 4.6' },
  { type: 'model', id: 'claude-opus-4-7', display_name: 'Claude Opus 4.7' },
  { type: 'model', id: 'claude-opus-4-8', display_name: 'Claude Opus 4.8' },
  { type: 'model', id: 'claude-haiku-4-5', display_name: 'Claude Haiku 4.5' },
];

/** Stable created_at stamped on Kiro models so date-sorting clients stay deterministic. */
const KIRO_MODELS_CREATED_AT = '2025-01-01T00:00:00Z';

/** Options passed by chat-handler so the adapter can write history back. */
export interface KiroAdapterOptions {
  /** Full message history (session.getMessages()) used for conversion. */
  messages?: AnthropicRequest['messages'];
  /** Invoked with the assistant content blocks once the response completes. */
  onComplete?: (blocks: ContentBlock[]) => void;
}

interface KiroProxyOptions {
  targetUrl: string;
  headers: Record<string, string>;
  body: string;
}

export class KiroAdapter implements LLMBackendAdapter {
  readonly name = 'kiro';

  private readonly auth: AuthResult;
  private readonly options: KiroAdapterOptions;

  constructor(auth: AuthResult, options: KiroAdapterOptions = {}) {
    this.auth = auth;
    this.options = options;
  }

  async listModels(): Promise<AnthropicModel[]> {
    // PRIMARY: ask the REAL Kiro backend (CodeWhisperer ListAvailableModels) so
    // the gateway /v1/models matches Kiro IDE exactly. Uses the same bearer
    // token + KiroIDE headers as generateAssistantResponse, so it works
    // whenever chat works. See kiro-models-client.ts for endpoint discovery.
    //
    // FALLBACK: any failure (no token, region probe fail, network/auth error,
    // unexpected payload) -> the static KIRO_MODELS list below. This keeps the
    // model dropdowns populated even when the backend is unreachable.
    if (this.auth.bearerToken) {
      try {
        const region = await resolveApiRegionAsync(null);
        const machineId = resolveMachineId({
          seed: this.auth.refreshToken || this.auth.bearerToken || null,
        });
        const live = await fetchKiroModels(region, this.auth.bearerToken, machineId);
        if (live.length > 0) {
          return live.map((m) => ({ ...m, created_at: m.created_at ?? KIRO_MODELS_CREATED_AT }));
        }
      } catch (err) {
        console.error(
          '[kiro-ts] ListAvailableModels failed, falling back to static KIRO_MODELS:',
          (err as Error).message,
        );
      }
    }
    return KIRO_MODELS.map((m) => ({ ...m, created_at: m.created_at ?? KIRO_MODELS_CREATED_AT }));
  }

  async createMessage(
    request: AnthropicRequest,
    res: http.ServerResponse,
    stream: boolean,
  ): Promise<void> {
    // Resolve the CodeWhisperer API region (cached after first probe).
    const region = await resolveApiRegionAsync(null);
    const host = `q.${region}.amazonaws.com`;
    const targetUrl = `https://${host}/generateAssistantResponse`;

    // Convert the (full-history) Anthropic request to conversationState. Use
    // the session's accumulated messages when provided so tool-result
    // continuations work; otherwise fall back to the request's own messages.
    const requestForConversion: AnthropicRequest = {
      ...request,
      messages: this.options.messages ?? request.messages,
    };

    let conversionResult;
    try {
      conversionResult = convertRequest(requestForConversion);
    } catch (err) {
      if (err instanceof ConversionError) {
        sendError(res, 400, 'invalid_request_error', err.message);
      } else {
        sendError(res, 500, 'api_error', 'Failed to build upstream request');
      }
      return;
    }

    // Inject profileArn at the root when available (kiro.rs behavior).
    const bodyObj: Record<string, unknown> = {
      conversationState: conversionResult.conversationState,
    };
    if (this.auth.profileArn) {
      bodyObj.profileArn = this.auth.profileArn;
    }
    const bodyStr = JSON.stringify(bodyObj);

    const machineId = resolveMachineId({
      seed: this.auth.refreshToken || this.auth.bearerToken || null,
    });
    const headers = buildKiroHeaders(host, this.auth.bearerToken || '', machineId);

    this.proxyKiroStream(
      { targetUrl, headers, body: bodyStr },
      res,
      request.model,
      stream,
      (blocks) => {
        if (blocks.length > 0) this.options.onComplete?.(blocks);
      },
    );
  }

  /**
   * Send the conversationState request to generateAssistantResponse, parse the
   * AWS Event Stream binary frames, convert them to Anthropic SSE, and either
   * stream them to the client or aggregate them into a single JSON response.
   */
  private proxyKiroStream(
    options: KiroProxyOptions,
    clientRes: http.ServerResponse,
    model: string,
    stream: boolean,
    onComplete: (blocks: ContentBlock[]) => void,
  ): void {
    const parsedUrl = new URL(options.targetUrl);
    const reqOptions: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        ...options.headers,
        'Content-Length': Buffer.byteLength(options.body),
      },
    };

    const decoder = new EventStreamDecoder();
    const converter = new KiroStreamConverter(model);
    const allEvents: SseEvent[] = [];
    let started = false;
    let streamHeadersWritten = false;

    const writeSse = (events: SseEvent[]) => {
      if (events.length === 0) return;
      allEvents.push(...events);
      if (stream) {
        if (!streamHeadersWritten) {
          writeSSEHeaders(clientRes);
          streamHeadersWritten = true;
        }
        for (const ev of events) {
          clientRes.write(formatSSEEvent(ev.event, ev.data));
        }
      }
    };

    const upstreamReq = https.request(reqOptions, (upstreamRes) => {
      const statusCode = upstreamRes.statusCode || 500;

      if (statusCode >= 400) {
        let errBody = '';
        upstreamRes.on('data', (c) => { errBody += c.toString(); });
        upstreamRes.on('end', () => {
          if (!clientRes.headersSent) {
            sendError(clientRes, statusCode, 'api_error', `Kiro API error ${statusCode}: ${errBody.substring(0, 500)}`);
          } else {
            clientRes.write(formatSSEEvent('error', {
              type: 'error',
              error: { type: 'api_error', message: `Kiro API error ${statusCode}` },
            }));
            clientRes.end();
          }
        });
        return;
      }

      if (!started) {
        writeSse(converter.start());
        started = true;
      }

      upstreamRes.on('data', (chunk: Buffer) => {
        decoder.feed(chunk);
        const frames = decoder.decodeAll();
        for (const frame of frames) {
          writeSse(converter.processFrame(frame));
        }
      });

      upstreamRes.on('end', () => {
        const frames = decoder.decodeAll();
        for (const frame of frames) {
          writeSse(converter.processFrame(frame));
        }
        writeSse(converter.finish());

        const blocks = collectBlocksFromSse(allEvents);
        onComplete(blocks);

        if (stream) {
          clientRes.end();
        } else {
          const message = buildMessageFromSse(allEvents, model);
          clientRes.writeHead(200, { 'Content-Type': 'application/json' });
          clientRes.end(JSON.stringify(message));
        }
      });

      upstreamRes.on('error', (err) => {
        if (!clientRes.headersSent) {
          sendError(clientRes, 502, 'api_error', 'Kiro stream error: ' + err.message);
        } else {
          clientRes.write(formatSSEEvent('error', {
            type: 'error',
            error: { type: 'api_error', message: 'Kiro stream dropped' },
          }));
          clientRes.end();
        }
      });
    });

    clientRes.on('close', () => { upstreamReq.destroy(); });

    upstreamReq.on('error', (err) => {
      if (!clientRes.headersSent) {
        sendError(clientRes, 502, 'api_error', 'Failed to connect to Kiro AI service: ' + err.message);
      }
    });

    upstreamReq.setTimeout(120000, () => {
      upstreamReq.destroy();
      if (!clientRes.headersSent) {
        sendError(clientRes, 504, 'api_error', 'Kiro upstream timeout');
      }
    });

    upstreamReq.write(options.body);
    upstreamReq.end();
  }
}

/**
 * Build the KiroIDE User-Agent headers used by generateAssistantResponse.
 * Mirrors kiro.rs `src/kiro/endpoint/ide.rs`.
 */
export function buildKiroHeaders(
  host: string,
  bearerToken: string,
  machineId: string,
): Record<string, string> {
  const systemVersion = `${os.platform()}_${os.release()}`;
  const xAmzUserAgent = `aws-sdk-js/1.0.34 KiroIDE-${KIRO_VERSION}-${machineId}`;
  const userAgent =
    `aws-sdk-js/1.0.34 ua/2.1 os/${systemVersion} lang/js md/nodejs#${NODE_VERSION} ` +
    `api/codewhispererstreaming#1.0.34 m/E KiroIDE-${KIRO_VERSION}-${machineId}`;

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${bearerToken}`,
    'x-amzn-codewhisperer-optout': 'true',
    'x-amzn-kiro-agent-mode': 'vibe',
    'x-amz-user-agent': xAmzUserAgent,
    'user-agent': userAgent,
    host,
    'amz-sdk-invocation-id': crypto.randomUUID(),
    'amz-sdk-request': 'attempt=1; max=3',
  };
}

/** Reconstruct content blocks from a list of Anthropic SSE events. */
export function collectBlocksFromSse(events: SseEvent[]): ContentBlock[] {
  const blockMap = new Map<number, ContentBlock>();
  const partialJson = new Map<number, string>();

  for (const ev of events) {
    const data = ev.data as any;
    if (ev.event === 'content_block_start' && data.content_block) {
      const block: ContentBlock = { type: data.content_block.type };
      if (data.content_block.type === 'tool_use') {
        block.id = data.content_block.id;
        block.name = data.content_block.name;
        block.input = {};
      } else if (data.content_block.type === 'text') {
        block.text = '';
      }
      blockMap.set(data.index, block);
    } else if (ev.event === 'content_block_delta' && data.delta) {
      const block = blockMap.get(data.index);
      if (block) {
        if (data.delta.type === 'text_delta' && data.delta.text) {
          block.text = (block.text || '') + data.delta.text;
        } else if (data.delta.type === 'input_json_delta' && data.delta.partial_json) {
          partialJson.set(data.index, (partialJson.get(data.index) || '') + data.delta.partial_json);
        }
      }
    }
  }

  const blocks: ContentBlock[] = [];
  for (const [index, block] of blockMap) {
    if (block.type === 'tool_use') {
      const pj = partialJson.get(index);
      if (pj) {
        try {
          block.input = JSON.parse(pj);
        } catch {
          block.input = {};
        }
      }
    }
    blocks.push(block);
  }
  return blocks;
}

/** Build a single Anthropic message JSON from collected SSE events (non-streaming). */
export function buildMessageFromSse(events: SseEvent[], model: string): Record<string, unknown> {
  const content = collectBlocksFromSse(events);
  let stopReason = 'end_turn';
  let outputTokens = 0;
  for (const ev of events) {
    if (ev.event === 'message_delta') {
      const data = ev.data as any;
      if (data.delta?.stop_reason) stopReason = data.delta.stop_reason;
      if (data.usage?.output_tokens) outputTokens = data.usage.output_tokens;
    }
  }
  return {
    id: `msg_${crypto.randomBytes(12).toString('hex')}`,
    type: 'message',
    role: 'assistant',
    model,
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: outputTokens },
  };
}
