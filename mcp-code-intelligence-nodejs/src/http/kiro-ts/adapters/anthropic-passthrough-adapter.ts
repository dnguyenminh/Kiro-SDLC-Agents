/**
 * Anthropic Passthrough Adapter — KSA-237 (Adapter Pattern)
 *
 * Implements LLMBackendAdapter for the bring-your-own-key path: forwards the
 * Anthropic request directly to api.anthropic.com using the client's
 * x-api-key. Used when the gateway has no Kiro SSO credentials, or when the
 * client explicitly supplies a real `sk-ant-` key.
 */

import * as http from 'http';
import * as https from 'https';
import { AnthropicRequest, ContentBlock } from '../types.js';
import { proxyStream, proxyNonStreaming, UpstreamError } from '../stream-proxy.js';
import { LLMBackendAdapter, AnthropicModel } from './llm-backend-adapter.js';
import { sendError } from './adapter-utils.js';

const ANTHROPIC_API_BASE = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Static fallback models served when no key is available or the upstream
 * `/v1/models` call fails. Mirrors the commonly-available Anthropic models.
 */
export const ANTHROPIC_FALLBACK_MODELS: AnthropicModel[] = [
  { type: 'model', id: 'claude-opus-4-1-20250805', display_name: 'Claude Opus 4.1', created_at: '2025-08-05T00:00:00Z' },
  { type: 'model', id: 'claude-sonnet-4-5-20250929', display_name: 'Claude Sonnet 4.5', created_at: '2025-09-29T00:00:00Z' },
  { type: 'model', id: 'claude-sonnet-4-20250514', display_name: 'Claude Sonnet 4', created_at: '2025-05-14T00:00:00Z' },
  { type: 'model', id: 'claude-haiku-4-5-20251001', display_name: 'Claude Haiku 4.5', created_at: '2025-10-01T00:00:00Z' },
  { type: 'model', id: 'claude-3-5-sonnet-20241022', display_name: 'Claude Sonnet 3.5', created_at: '2024-10-22T00:00:00Z' },
];

/** Options passed by chat-handler so the adapter can build/store history. */
export interface AnthropicPassthroughOptions {
  /** Upstream body builder using full session history. */
  buildBody?: (request: AnthropicRequest) => Record<string, unknown>;
  /** Invoked with the assistant content blocks once the response completes. */
  onComplete?: (blocks: ContentBlock[]) => void;
}

export class AnthropicPassthroughAdapter implements LLMBackendAdapter {
  readonly name = 'anthropic-passthrough';

  private readonly apiKey: string | undefined;
  private readonly options: AnthropicPassthroughOptions;

  constructor(apiKey: string | undefined, options: AnthropicPassthroughOptions = {}) {
    this.apiKey = apiKey;
    this.options = options;
  }

  async listModels(): Promise<AnthropicModel[]> {
    // No real key (or only the local-trusted placeholder) -> static fallback.
    if (!this.apiKey || this.apiKey === 'local-trusted') {
      return ANTHROPIC_FALLBACK_MODELS;
    }
    try {
      const models = await fetchAnthropicModels(this.apiKey);
      return models.length > 0 ? models : ANTHROPIC_FALLBACK_MODELS;
    } catch (err) {
      console.error('[kiro-ts] Anthropic /v1/models fetch failed, using fallback:', (err as Error).message);
      return ANTHROPIC_FALLBACK_MODELS;
    }
  }

  async createMessage(
    request: AnthropicRequest,
    res: http.ServerResponse,
    stream: boolean,
  ): Promise<void> {
    const upstreamBody = this.options.buildBody
      ? this.options.buildBody(request)
      : defaultBuildBody(request);
    const targetUrl = `${ANTHROPIC_API_BASE}/v1/messages`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey || '',
      'anthropic-version': ANTHROPIC_VERSION,
    };
    const bodyStr = JSON.stringify(upstreamBody);

    if (stream) {
      proxyStream(
        { targetUrl, headers, body: bodyStr },
        res,
        (contentBlocks) => {
          const blocks = extractContentBlocks(contentBlocks);
          if (blocks.length > 0) this.options.onComplete?.(blocks);
        },
        (err) => {
          if (!res.headersSent) {
            if (err instanceof UpstreamError) {
              sendError(res, err.statusCode, 'api_error', err.message);
            } else {
              sendError(res, 502, 'api_error', 'Failed to connect to AI service');
            }
          }
        },
      );
    } else {
      try {
        const upstream = await proxyNonStreaming({ targetUrl, headers, body: bodyStr });
        if (upstream.status >= 400) {
          res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
          res.end(upstream.body);
          return;
        }
        const response = JSON.parse(upstream.body);
        if (response.content) this.options.onComplete?.(response.content);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(upstream.body);
      } catch (err: any) {
        sendError(res, 502, 'api_error', err.message || 'Failed to connect to AI service');
      }
    }
  }
}

/** Default body builder when chat-handler does not supply one. */
function defaultBuildBody(request: AnthropicRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: request.model,
    max_tokens: request.max_tokens,
    messages: request.messages,
    stream: request.stream !== false,
  };
  if (request.system) body.system = request.system;
  if (request.temperature !== undefined) body.temperature = request.temperature;
  if (request.tools && request.tools.length > 0) body.tools = request.tools;
  if (request.tool_choice) body.tool_choice = request.tool_choice;
  if (request.stop_sequences && request.stop_sequences.length > 0) body.stop_sequences = request.stop_sequences;
  if (request.metadata) body.metadata = request.metadata;
  return body;
}

/** Extract content blocks from collected streaming events. */
function extractContentBlocks(streamData: unknown[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const blockMap = new Map<number, ContentBlock>();

  for (const item of streamData) {
    const event = item as any;
    if (event.type === 'content_block_start' && event.content_block) {
      const block: ContentBlock = { type: event.content_block.type };
      if (event.content_block.type === 'tool_use') {
        block.id = event.content_block.id;
        block.name = event.content_block.name;
        block.input = {};
      } else if (event.content_block.type === 'text') {
        block.text = '';
      }
      blockMap.set(event.index, block);
    } else if (event.type === 'content_block_delta' && event.delta) {
      const block = blockMap.get(event.index);
      if (block) {
        if (event.delta.type === 'text_delta' && event.delta.text) {
          block.text = (block.text || '') + event.delta.text;
        } else if (event.delta.type === 'input_json_delta' && event.delta.partial_json) {
          try {
            block.input = JSON.parse(event.delta.partial_json);
          } catch {
            // Partial JSON — accumulate (best effort)
          }
        }
      }
    }
  }

  for (const [, block] of blockMap) blocks.push(block);
  return blocks;
}

/**
 * GET https://api.anthropic.com/v1/models using the supplied key. Maps the
 * response to AnthropicModel[]. Throws on non-2xx or network failure.
 */
export function fetchAnthropicModels(apiKey: string): Promise<AnthropicModel[]> {
  return new Promise((resolve, reject) => {
    const reqOptions: https.RequestOptions = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/models?limit=100',
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
    };

    const req = https.request(reqOptions, (resp) => {
      let body = '';
      resp.on('data', (c) => { body += c.toString(); });
      resp.on('end', () => {
        const status = resp.statusCode || 500;
        if (status >= 400) {
          reject(new Error(`Anthropic models API error ${status}`));
          return;
        }
        try {
          const parsed = JSON.parse(body);
          const data = Array.isArray(parsed.data) ? parsed.data : [];
          const models: AnthropicModel[] = data.map((m: any) => ({
            type: 'model' as const,
            id: m.id,
            display_name: m.display_name || m.id,
            created_at: m.created_at,
          }));
          resolve(models);
        } catch (err) {
          reject(new Error('Failed to parse Anthropic models response'));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('Anthropic models request timeout')); });
    req.end();
  });
}
