/**
 * kiro-ts Unit Tests — KSA-237
 * Tests request-validator, conversation-store, auth-resolver, sigv4-signer, stream-proxy.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

import { validateRequest } from '../request-validator.js';
import { ConversationStore, ConversationSession, ToolIdMismatchError } from '../conversation-store.js';
import { resolveAuth, AuthenticationError, setCredentialPathOverride, initializeAuth, getGatewayApiKey } from '../auth-resolver.js';
import { signRequest } from '../sigv4-signer.js';
import { formatSSEEvent } from '../stream-proxy.js';

// =============================================================================
// PBT-01: Request Validator Fuzzing
// =============================================================================
describe('PBT-01: Request Validator Fuzzing', () => {
  it('valid requests always pass validation', () => {
    fc.assert(
      fc.property(
        fc.record({
          model: fc.string({ minLength: 1, maxLength: 50 }).map((s) => `m${s.replace(/\s/g, 'x')}`),
          messages: fc.array(
            fc.record({ role: fc.constant('user'), content: fc.string() }),
            { minLength: 1, maxLength: 5 },
          ),
          max_tokens: fc.integer({ min: 1, max: 200000 }),
        }),
        (input) => {
          const result = validateRequest(input);
          expect(result.valid).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('missing model always produces error mentioning model', () => {
    fc.assert(
      fc.property(
        fc.record({
          messages: fc.array(
            fc.record({ role: fc.constant('user'), content: fc.string() }),
            { minLength: 1, maxLength: 3 },
          ),
          max_tokens: fc.integer({ min: 1, max: 200000 }),
        }),
        (input) => {
          const result = validateRequest(input);
          expect(result.valid).toBe(false);
          expect(result.error?.error.message).toContain('model');
        },
      ),
      { numRuns: 50 },
    );
  });

  it('max_tokens outside range always rejected', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: -1000, max: 0 }),
          fc.integer({ min: 200001, max: 500000 }),
        ),
        (maxTokens) => {
          const result = validateRequest({
            model: 'claude-sonnet-4-20250514',
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: maxTokens,
          });
          expect(result.valid).toBe(false);
          expect(result.error?.error.message).toContain('max_tokens');
        },
      ),
      { numRuns: 50 },
    );
  });
});

// =============================================================================
// PBT-04: Max Tokens Boundary
// =============================================================================
describe('PBT-04: Max Tokens Boundary', () => {
  it('max_tokens in [1, 200000] always accepted', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 200000 }), (mt) => {
        const result = validateRequest({
          model: 'claude-sonnet-4-20250514',
          messages: [{ role: 'user', content: 'x' }],
          max_tokens: mt,
        });
        expect(result.valid).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

// =============================================================================
// UT-01: Request Validator — Valid Requests
// =============================================================================
describe('UT-01: validateRequest accepts well-formed requests', () => {
  it('minimal valid request passes', () => {
    const result = validateRequest({
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 1024,
    });
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('full request with all optional fields passes', () => {
    const result = validateRequest({
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 4096,
      stream: true,
      temperature: 0.7,
      system: 'You are helpful',
      tools: [{ name: 'get_file', description: 'Read file', input_schema: { type: 'object' } }],
      tool_choice: { type: 'auto' },
    });
    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// UT-02: Request Validator — Error Format
// =============================================================================
describe('UT-02: validateRequest returns Anthropic-format errors', () => {
  it('empty body returns invalid_request_error', () => {
    const result = validateRequest({});
    expect(result.valid).toBe(false);
    expect(result.error?.type).toBe('error');
    expect(result.error?.error.type).toBe('invalid_request_error');
    expect(result.error?.error.message).toContain('model');
  });

  it('empty messages array returns error', () => {
    const result = validateRequest({
      model: 'claude-sonnet-4-20250514',
      messages: [],
      max_tokens: 1024,
    });
    expect(result.valid).toBe(false);
    expect(result.error?.error.message).toContain('messages');
  });

  it('max_tokens=-1 returns error', () => {
    const result = validateRequest({
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: -1,
    });
    expect(result.valid).toBe(false);
    expect(result.error?.error.message).toContain('max_tokens');
  });

  it('temperature=2.0 returns error', () => {
    const result = validateRequest({
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 1024,
      temperature: 2.0,
    });
    expect(result.valid).toBe(false);
    expect(result.error?.error.message).toContain('temperature');
  });
});

// =============================================================================
// UT-03: Auth Resolver — Gateway mode (KSA-237)
// =============================================================================
describe('UT-03: resolveAuth follows gateway rules', () => {
  const tmpDir = path.join(os.tmpdir(), `kiro-ts-test-${Date.now()}`);

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    setCredentialPathOverride(null);
  });

  afterEach(() => {
    setCredentialPathOverride(null);
    try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
  });

  it('passes through a REAL Anthropic key (sk-ant-...) when no Kiro token present', () => {
    // Point to a non-existent token file so no Kiro credentials are loaded
    setCredentialPathOverride(path.join(tmpDir, 'nonexistent.json'));
    const result = resolveAuth('sk-ant-test-key');
    expect(result.mode).toBe('api_key');
    expect(result.apiKey).toBe('sk-ant-test-key');
  });

  it('serves Kiro mode with a valid token even when client sends gateway key', () => {
    const tokenFile = path.join(tmpDir, 'kiro-auth-token.json');
    fs.writeFileSync(tokenFile, JSON.stringify({
      accessToken: 'kiro-access-token-abc',
      refreshToken: 'kiro-refresh-token-xyz',
      expiresAt: '2099-12-31T23:59:59Z',
      region: 'ap-southeast-1',
    }));
    setCredentialPathOverride(tokenFile);

    initializeAuth();
    const result = resolveAuth(getGatewayApiKey());
    expect(result.mode).toBe('kiro');
    expect(result.bearerToken).toBe('kiro-access-token-abc');
    expect(result.region).toBe('ap-southeast-1');
    expect(result.refreshToken).toBe('kiro-refresh-token-xyz');
  });

  it('serves Kiro mode with empty key when token present', () => {
    const tokenFile = path.join(tmpDir, 'kiro-auth-token.json');
    fs.writeFileSync(tokenFile, JSON.stringify({
      accessToken: 'kiro-access-token-abc',
      expiresAt: '2099-12-31T23:59:59Z',
      region: 'us-east-1',
    }));
    setCredentialPathOverride(tokenFile);

    initializeAuth();
    const result = resolveAuth('');
    expect(result.mode).toBe('kiro');
    expect(result.bearerToken).toBe('kiro-access-token-abc');
  });

  it('serves Kiro mode even when client sends a WRONG (non-anthropic) key', () => {
    const tokenFile = path.join(tmpDir, 'kiro-auth-token.json');
    fs.writeFileSync(tokenFile, JSON.stringify({
      accessToken: 'kiro-access-token-abc',
      expiresAt: '2099-12-31T23:59:59Z',
      region: 'us-east-1',
    }));
    setCredentialPathOverride(tokenFile);

    initializeAuth();
    const result = resolveAuth('some-random-wrong-key');
    // Wrong key does NOT fall through to Anthropic passthrough — gateway serves Kiro.
    expect(result.mode).toBe('kiro');
    expect(result.bearerToken).toBe('kiro-access-token-abc');
  });

  it('honours bring-your-own real Anthropic key even when Kiro token present', () => {
    const tokenFile = path.join(tmpDir, 'kiro-auth-token.json');
    fs.writeFileSync(tokenFile, JSON.stringify({
      accessToken: 'kiro-access-token-abc',
      expiresAt: '2099-12-31T23:59:59Z',
      region: 'us-east-1',
    }));
    setCredentialPathOverride(tokenFile);

    initializeAuth();
    const result = resolveAuth('sk-ant-my-own-key');
    expect(result.mode).toBe('api_key');
    expect(result.apiKey).toBe('sk-ant-my-own-key');
  });

  it('falls back to local-trusted api_key mode when no token and no header', () => {
    setCredentialPathOverride(path.join(tmpDir, 'nonexistent.json'));
    const result = resolveAuth('');
    // Implementation accepts local requests as trusted rather than throwing
    expect(result.mode).toBe('api_key');
  });
});

// =============================================================================
// UT-03b: Gateway API key — stable & persisted (KSA-237)
// =============================================================================
describe('UT-03b: getGatewayApiKey is stable', () => {
  it('returns a stable sk-kiro- key across calls', () => {
    const k1 = getGatewayApiKey();
    const k2 = getGatewayApiKey();
    expect(k1).toBe(k2);
    expect(k1.startsWith('sk-kiro-')).toBe(true);
  });
});

// =============================================================================
// UT-05: Conversation Store — Tool ID Tracking
// =============================================================================
describe('UT-05: ConversationStore indexes tool_use IDs', () => {
  it('indexes tool_use blocks from assistant messages', () => {
    const store = new ConversationStore();
    const session = store.getOrCreate('test-session');

    session.addAssistantMessage([
      { type: 'tool_use', id: 'toolu_abc', name: 'get_file', input: { path: '/x' } },
      { type: 'text', text: 'Let me read that file.' },
    ]);

    expect(session.findToolUse('toolu_abc')).toEqual({
      id: 'toolu_abc',
      name: 'get_file',
      input: { path: '/x' },
    });
    expect(session.findToolUse('nonexistent')).toBeNull();
    expect(session.getAllToolUseIds()).toContain('toolu_abc');
  });
});

// =============================================================================
// UT-06: Tool ID Mismatch Error
// =============================================================================
describe('UT-06: Tool ID mismatch produces descriptive error', () => {
  it('throws ToolIdMismatchError with available IDs', () => {
    const store = new ConversationStore();
    const session = store.getOrCreate('test-session');

    session.addAssistantMessage([
      { type: 'tool_use', id: 'toolu_A', name: 'tool_a', input: {} },
      { type: 'tool_use', id: 'toolu_B', name: 'tool_b', input: {} },
    ]);

    expect(() => session.addToolResult('toolu_WRONG', 'result', false))
      .toThrow(ToolIdMismatchError);

    try {
      session.addToolResult('toolu_WRONG', 'result', false);
    } catch (err) {
      const e = err as ToolIdMismatchError;
      expect(e.receivedId).toBe('toolu_WRONG');
      expect(e.availableIds).toContain('toolu_A');
      expect(e.availableIds).toContain('toolu_B');
      expect(e.message).toContain('toolu_WRONG');
    }
  });

  it('valid tool result does not throw', () => {
    const store = new ConversationStore();
    const session = store.getOrCreate('test-session');

    session.addAssistantMessage([
      { type: 'tool_use', id: 'toolu_valid', name: 'tool', input: {} },
    ]);

    expect(() => session.addToolResult('toolu_valid', 'result', false)).not.toThrow();
  });
});

// =============================================================================
// UT-08: SSE Event Formatting
// =============================================================================
describe('UT-08: formatSSEEvent produces valid strings', () => {
  it('formats content_block_delta correctly', () => {
    const result = formatSSEEvent('content_block_delta', {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: 'Hello' },
    });

    expect(result).toMatch(/^event: content_block_delta\n/);
    expect(result).toMatch(/\ndata: .+\n\n$/);

    // Parse data line
    const dataLine = result.split('\n')[1];
    const json = JSON.parse(dataLine.replace('data: ', ''));
    expect(json.type).toBe('content_block_delta');
    expect(json.delta.text).toBe('Hello');
  });

  it('formats message_stop correctly', () => {
    const result = formatSSEEvent('message_stop', { type: 'message_stop' });
    expect(result).toBe('event: message_stop\ndata: {"type":"message_stop"}\n\n');
  });
});

// =============================================================================
// UT-10: SigV4 Signer
// =============================================================================
describe('UT-10: SigV4 signer produces correct signatures', () => {
  it('generates Authorization header with correct format', () => {
    const signed = signRequest({
      method: 'POST',
      url: 'https://kiro.api.us-east-1.amazonaws.com/v1/messages',
      headers: { 'content-type': 'application/json' },
      body: '{"model":"claude-sonnet-4-20250514","messages":[]}',
      credentials: {
        accessKeyId: 'ASIATESTKEY123456',
        secretAccessKey: 'testSecretAccessKey',
        sessionToken: 'testSessionToken',
        expiration: new Date('2099-12-31'),
      },
      region: 'us-east-1',
      datetime: '20260605T120000Z',
    });

    expect(signed.headers['Authorization']).toMatch(
      /^AWS4-HMAC-SHA256 Credential=ASIATESTKEY123456\/20260605\/us-east-1\/kiro\/aws4_request, SignedHeaders=.+, Signature=[a-f0-9]{64}$/
    );
    expect(signed.headers['x-amz-date']).toBe('20260605T120000Z');
    expect(signed.headers['x-amz-security-token']).toBe('testSessionToken');
    expect(signed.headers['x-amz-content-sha256']).toMatch(/^[a-f0-9]{64}$/);
  });

  it('omits x-amz-security-token when no session token', () => {
    const signed = signRequest({
      method: 'POST',
      url: 'https://kiro.api.us-east-1.amazonaws.com/v1/messages',
      headers: { 'content-type': 'application/json' },
      body: '{}',
      credentials: {
        accessKeyId: 'AKIATESTKEY123456',
        secretAccessKey: 'testSecretAccessKey',
        sessionToken: '',
        expiration: new Date('2099-12-31'),
      },
      region: 'us-east-1',
      datetime: '20260605T120000Z',
    });

    expect(signed.headers['x-amz-security-token']).toBeUndefined();
  });

  it('produces different signatures for different bodies', () => {
    const opts = {
      method: 'POST',
      url: 'https://kiro.api.us-east-1.amazonaws.com/v1/messages',
      headers: { 'content-type': 'application/json' },
      credentials: {
        accessKeyId: 'ASIATESTKEY123456',
        secretAccessKey: 'testSecretAccessKey',
        sessionToken: 'tok',
        expiration: new Date('2099-12-31'),
      },
      region: 'us-east-1',
      datetime: '20260605T120000Z',
    };

    const sig1 = signRequest({ ...opts, body: '{"a":1}' });
    const sig2 = signRequest({ ...opts, body: '{"b":2}' });

    const extractSig = (auth: string) => auth.split('Signature=')[1];
    expect(extractSig(sig1.headers['Authorization'])).not.toBe(
      extractSig(sig2.headers['Authorization']),
    );
  });
});

// =============================================================================
// UT-11: API Region Auto-Detection (KSA-237)
// =============================================================================
import {
  resolveApiRegion,
  resolveApiRegionAsync,
  invalidateApiRegionCache,
} from '../auth-resolver.js';

describe('UT-11: resolveApiRegion / resolveApiRegionAsync', () => {
  const regionCachePath = path.join(os.homedir(), '.aws', 'sso', 'cache', 'kiro-ts-api-region');
  const savedEnv = process.env.KIRO_API_REGION;

  beforeEach(() => {
    delete process.env.KIRO_API_REGION;
    invalidateApiRegionCache();
  });

  afterEach(() => {
    if (savedEnv === undefined) {
      delete process.env.KIRO_API_REGION;
    } else {
      process.env.KIRO_API_REGION = savedEnv;
    }
    invalidateApiRegionCache();
  });

  it('explicit token.apiRegion takes top priority (sync + async)', async () => {
    const token = { accessToken: 'x', expiresAt: '2099-01-01T00:00:00Z', region: 'ap-southeast-1', apiRegion: 'eu-central-1' };
    expect(resolveApiRegion(token as any)).toBe('eu-central-1');
    expect(await resolveApiRegionAsync(token as any)).toBe('eu-central-1');
  });

  it('env KIRO_API_REGION overrides probe when no token.apiRegion', async () => {
    process.env.KIRO_API_REGION = 'us-west-2';
    const token = { accessToken: 'x', expiresAt: '2099-01-01T00:00:00Z', region: 'ap-southeast-1' };
    expect(resolveApiRegion(token as any)).toBe('us-west-2');
    expect(await resolveApiRegionAsync(token as any)).toBe('us-west-2');
  });

  it('sync resolveApiRegion returns default us-east-1 when no cache/explicit', () => {
    expect(resolveApiRegion(null)).toBe('us-east-1');
  });

  it('async probe resolves a real CodeWhisperer region and caches it', async () => {
    // q.{region}.amazonaws.com should resolve on any machine with internet.
    // The probe order starts with the SSO region then known regions; the
    // result is one of the candidate regions and gets cached.
    const token = { accessToken: 'x', expiresAt: '2099-01-01T00:00:00Z', region: 'us-east-1' };
    const region = await resolveApiRegionAsync(token as any, { forceProbe: true });
    expect(typeof region).toBe('string');
    expect(region.length).toBeGreaterThan(0);
    // After a successful probe, the sync resolver returns the cached value.
    expect(resolveApiRegion(null)).toBe(region);
  });

  it('invalidateApiRegionCache clears in-memory + persisted cache', async () => {
    await resolveApiRegionAsync({ accessToken: 'x', expiresAt: '2099-01-01T00:00:00Z', region: 'us-east-1' } as any, { forceProbe: true });
    invalidateApiRegionCache();
    expect(fs.existsSync(regionCachePath)).toBe(false);
    // Sync resolver falls back to default after invalidation.
    expect(resolveApiRegion(null)).toBe('us-east-1');
  });
});
