/**
 * kiro-ts Adapter Pattern Tests — KSA-237
 *
 * Covers the Adapter pattern refactor:
 *  - selectAdapter factory (auth.mode -> adapter)
 *  - KiroAdapter.listModels (source of truth for Kiro model list)
 *  - AnthropicPassthroughAdapter.listModels fallback
 *  - models-handler response format + /anthropic prefix routing
 *  - buildModelsListResponse envelope
 *
 * Maps to STC: IT-01 (pipeline), UT-03 (auth selection), PBT-02 (SSE/model format).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'http';
import { EventEmitter } from 'events';

import { selectAdapter, buildModelsListResponse } from '../adapters/index.js';
import { KiroAdapter } from '../adapters/kiro-adapter.js';
import { AnthropicPassthroughAdapter, ANTHROPIC_FALLBACK_MODELS } from '../adapters/anthropic-passthrough-adapter.js';
import { handleModelsRoute } from '../models-handler.js';
import { mapModel } from '../kiro-converter.js';
import { setCredentialPathOverride } from '../auth-resolver.js';
import { AuthResult } from '../types.js';
import { AnthropicModel } from '../adapters/llm-backend-adapter.js';

// ---------------------------------------------------------------------------
// Mock http.ServerResponse capture
// ---------------------------------------------------------------------------

class MockResponse extends EventEmitter {
  statusCode = 0;
  headers: Record<string, string> = {};
  body = '';
  headersSent = false;

  writeHead(status: number, headers?: Record<string, string>) {
    this.statusCode = status;
    if (headers) this.headers = headers;
    this.headersSent = true;
    return this;
  }
  write(chunk: string) { this.body += chunk; return true; }
  end(chunk?: string) { if (chunk) this.body += chunk; this.emit('finish'); return this; }
}

function mockReq(method: string, url: string, headers: Record<string, string> = {}): http.IncomingMessage {
  const req = new EventEmitter() as http.IncomingMessage;
  (req as any).method = method;
  (req as any).url = url;
  (req as any).headers = headers;
  return req;
}

// ===========================================================================
// selectAdapter factory — UT-03 (auth.mode selection)
// ===========================================================================
describe('selectAdapter factory', () => {
  it('returns KiroAdapter for kiro mode', () => {
    const auth: AuthResult = {
      mode: 'kiro',
      bearerToken: 'tok',
      region: 'us-east-1',
    };
    const adapter = selectAdapter(auth);
    expect(adapter).toBeInstanceOf(KiroAdapter);
    expect(adapter.name).toBe('kiro');
  });

  it('returns AnthropicPassthroughAdapter for api_key mode', () => {
    const auth: AuthResult = { mode: 'api_key', apiKey: 'sk-ant-xyz' };
    const adapter = selectAdapter(auth);
    expect(adapter).toBeInstanceOf(AnthropicPassthroughAdapter);
    expect(adapter.name).toBe('anthropic-passthrough');
  });
});

// ===========================================================================
// KiroAdapter.listModels — source of truth
// ===========================================================================
describe('KiroAdapter.listModels', () => {
  it('returns the canonical Kiro model list', async () => {
    const adapter = new KiroAdapter({ mode: 'kiro' });
    const models = await adapter.listModels();
    const ids = models.map((m) => m.id);
    expect(ids).toContain('claude-sonnet-4-5');
    expect(ids).toContain('claude-sonnet-4-6');
    expect(ids).toContain('claude-opus-4-5');
    expect(ids).toContain('claude-opus-4-6');
    expect(ids).toContain('claude-opus-4-7');
    expect(ids).toContain('claude-opus-4-8');
    expect(ids).toContain('claude-haiku-4-5');
  });

  it('every listed model has type=model, id, display_name', async () => {
    const adapter = new KiroAdapter({ mode: 'kiro' });
    const models = await adapter.listModels();
    for (const m of models) {
      expect(m.type).toBe('model');
      expect(typeof m.id).toBe('string');
      expect(m.id.length).toBeGreaterThan(0);
      expect(typeof m.display_name).toBe('string');
      expect(m.display_name.length).toBeGreaterThan(0);
    }
  });

  it('every Kiro model id maps via kiro-converter mapModel', async () => {
    const adapter = new KiroAdapter({ mode: 'kiro' });
    const models = await adapter.listModels();
    for (const m of models) {
      // mapModel must resolve (non-null) for the gateway to accept the model.
      expect(mapModel(m.id)).not.toBeNull();
    }
  });
});

// ===========================================================================
// AnthropicPassthroughAdapter.listModels — fallback when no key
// ===========================================================================
describe('AnthropicPassthroughAdapter.listModels', () => {
  it('returns static fallback when no key', async () => {
    const adapter = new AnthropicPassthroughAdapter(undefined);
    const models = await adapter.listModels();
    expect(models).toEqual(ANTHROPIC_FALLBACK_MODELS);
  });

  it('returns static fallback for local-trusted placeholder', async () => {
    const adapter = new AnthropicPassthroughAdapter('local-trusted');
    const models = await adapter.listModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].type).toBe('model');
  });
});

// ===========================================================================
// buildModelsListResponse — Anthropic /v1/models envelope
// ===========================================================================
describe('buildModelsListResponse', () => {
  it('wraps models with pagination metadata', () => {
    const models: AnthropicModel[] = [
      { type: 'model', id: 'a', display_name: 'A' },
      { type: 'model', id: 'b', display_name: 'B' },
    ];
    const resp = buildModelsListResponse(models);
    expect(resp.data).toHaveLength(2);
    expect(resp.has_more).toBe(false);
    expect(resp.first_id).toBe('a');
    expect(resp.last_id).toBe('b');
  });

  it('handles empty list', () => {
    const resp = buildModelsListResponse([]);
    expect(resp.data).toHaveLength(0);
    expect(resp.first_id).toBeNull();
    expect(resp.last_id).toBeNull();
  });
});

// ===========================================================================
// models-handler routing + response format
// ===========================================================================
describe('handleModelsRoute', () => {
  beforeEach(() => {
    // Force no Kiro credentials -> Anthropic fallback (deterministic, no network).
    setCredentialPathOverride('/nonexistent/kiro-token.json');
  });
  afterEach(() => {
    setCredentialPathOverride(null);
  });

  it('ignores non-GET methods', () => {
    const res = new MockResponse() as unknown as http.ServerResponse;
    const handled = handleModelsRoute(mockReq('POST', '/v1/models'), res);
    expect(handled).toBe(false);
  });

  it('ignores unrelated paths', () => {
    const res = new MockResponse() as unknown as http.ServerResponse;
    const handled = handleModelsRoute(mockReq('GET', '/v1/messages'), res);
    expect(handled).toBe(false);
  });

  it('handles GET /v1/models with Anthropic format response', async () => {
    const res = new MockResponse();
    const handled = handleModelsRoute(mockReq('GET', '/v1/models'), res as unknown as http.ServerResponse);
    expect(handled).toBe(true);
    await new Promise<void>((resolve) => res.once('finish', resolve));
    expect(res.statusCode).toBe(200);
    const payload = JSON.parse(res.body);
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data.length).toBeGreaterThan(0);
    expect(payload).toHaveProperty('has_more');
    expect(payload).toHaveProperty('first_id');
    expect(payload).toHaveProperty('last_id');
    for (const m of payload.data) {
      expect(m.type).toBe('model');
      expect(m).toHaveProperty('id');
      expect(m).toHaveProperty('display_name');
    }
  });

  it('handles the /anthropic/v1/models prefixed path (after router strip)', async () => {
    // The router strips /anthropic, but the handler also tolerates it directly.
    const res = new MockResponse();
    const handled = handleModelsRoute(mockReq('GET', '/anthropic/v1/models'), res as unknown as http.ServerResponse);
    expect(handled).toBe(true);
    await new Promise<void>((resolve) => res.once('finish', resolve));
    expect(res.statusCode).toBe(200);
    const payload = JSON.parse(res.body);
    expect(Array.isArray(payload.data)).toBe(true);
  });

  it('handles query string on /v1/models?limit=100', async () => {
    const res = new MockResponse();
    const handled = handleModelsRoute(mockReq('GET', '/v1/models?limit=100'), res as unknown as http.ServerResponse);
    expect(handled).toBe(true);
    await new Promise<void>((resolve) => res.once('finish', resolve));
    expect(res.statusCode).toBe(200);
  });
});
