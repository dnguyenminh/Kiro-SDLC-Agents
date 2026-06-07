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
 * kiro-ts Unit Tests — KSA-237
 * Tests request-validator, conversation-store, auth-resolver, sigv4-signer, stream-proxy.
 */
const vitest_1 = require("vitest");
const fc = __importStar(require("fast-check"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const request_validator_js_1 = require("../request-validator.js");
const conversation_store_js_1 = require("../conversation-store.js");
const auth_resolver_js_1 = require("../auth-resolver.js");
const sigv4_signer_js_1 = require("../sigv4-signer.js");
const stream_proxy_js_1 = require("../stream-proxy.js");
// =============================================================================
// PBT-01: Request Validator Fuzzing
// =============================================================================
(0, vitest_1.describe)('PBT-01: Request Validator Fuzzing', () => {
    (0, vitest_1.it)('valid requests always pass validation', () => {
        fc.assert(fc.property(fc.record({
            model: fc.string({ minLength: 1, maxLength: 50 }).map((s) => `m${s.replace(/\s/g, 'x')}`),
            messages: fc.array(fc.record({ role: fc.constant('user'), content: fc.string() }), { minLength: 1, maxLength: 5 }),
            max_tokens: fc.integer({ min: 1, max: 200000 }),
        }), (input) => {
            const result = (0, request_validator_js_1.validateRequest)(input);
            (0, vitest_1.expect)(result.valid).toBe(true);
        }), { numRuns: 100 });
    });
    (0, vitest_1.it)('missing model always produces error mentioning model', () => {
        fc.assert(fc.property(fc.record({
            messages: fc.array(fc.record({ role: fc.constant('user'), content: fc.string() }), { minLength: 1, maxLength: 3 }),
            max_tokens: fc.integer({ min: 1, max: 200000 }),
        }), (input) => {
            const result = (0, request_validator_js_1.validateRequest)(input);
            (0, vitest_1.expect)(result.valid).toBe(false);
            (0, vitest_1.expect)(result.error?.error.message).toContain('model');
        }), { numRuns: 50 });
    });
    (0, vitest_1.it)('max_tokens outside range always rejected', () => {
        fc.assert(fc.property(fc.oneof(fc.integer({ min: -1000, max: 0 }), fc.integer({ min: 200001, max: 500000 })), (maxTokens) => {
            const result = (0, request_validator_js_1.validateRequest)({
                model: 'claude-sonnet-4-20250514',
                messages: [{ role: 'user', content: 'hi' }],
                max_tokens: maxTokens,
            });
            (0, vitest_1.expect)(result.valid).toBe(false);
            (0, vitest_1.expect)(result.error?.error.message).toContain('max_tokens');
        }), { numRuns: 50 });
    });
});
// =============================================================================
// PBT-04: Max Tokens Boundary
// =============================================================================
(0, vitest_1.describe)('PBT-04: Max Tokens Boundary', () => {
    (0, vitest_1.it)('max_tokens in [1, 200000] always accepted', () => {
        fc.assert(fc.property(fc.integer({ min: 1, max: 200000 }), (mt) => {
            const result = (0, request_validator_js_1.validateRequest)({
                model: 'claude-sonnet-4-20250514',
                messages: [{ role: 'user', content: 'x' }],
                max_tokens: mt,
            });
            (0, vitest_1.expect)(result.valid).toBe(true);
        }), { numRuns: 100 });
    });
});
// =============================================================================
// UT-01: Request Validator — Valid Requests
// =============================================================================
(0, vitest_1.describe)('UT-01: validateRequest accepts well-formed requests', () => {
    (0, vitest_1.it)('minimal valid request passes', () => {
        const result = (0, request_validator_js_1.validateRequest)({
            model: 'claude-sonnet-4-20250514',
            messages: [{ role: 'user', content: 'Hello' }],
            max_tokens: 1024,
        });
        (0, vitest_1.expect)(result.valid).toBe(true);
        (0, vitest_1.expect)(result.error).toBeUndefined();
    });
    (0, vitest_1.it)('full request with all optional fields passes', () => {
        const result = (0, request_validator_js_1.validateRequest)({
            model: 'claude-sonnet-4-20250514',
            messages: [{ role: 'user', content: 'Hello' }],
            max_tokens: 4096,
            stream: true,
            temperature: 0.7,
            system: 'You are helpful',
            tools: [{ name: 'get_file', description: 'Read file', input_schema: { type: 'object' } }],
            tool_choice: { type: 'auto' },
        });
        (0, vitest_1.expect)(result.valid).toBe(true);
    });
});
// =============================================================================
// UT-02: Request Validator — Error Format
// =============================================================================
(0, vitest_1.describe)('UT-02: validateRequest returns Anthropic-format errors', () => {
    (0, vitest_1.it)('empty body returns invalid_request_error', () => {
        const result = (0, request_validator_js_1.validateRequest)({});
        (0, vitest_1.expect)(result.valid).toBe(false);
        (0, vitest_1.expect)(result.error?.type).toBe('error');
        (0, vitest_1.expect)(result.error?.error.type).toBe('invalid_request_error');
        (0, vitest_1.expect)(result.error?.error.message).toContain('model');
    });
    (0, vitest_1.it)('empty messages array returns error', () => {
        const result = (0, request_validator_js_1.validateRequest)({
            model: 'claude-sonnet-4-20250514',
            messages: [],
            max_tokens: 1024,
        });
        (0, vitest_1.expect)(result.valid).toBe(false);
        (0, vitest_1.expect)(result.error?.error.message).toContain('messages');
    });
    (0, vitest_1.it)('max_tokens=-1 returns error', () => {
        const result = (0, request_validator_js_1.validateRequest)({
            model: 'claude-sonnet-4-20250514',
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: -1,
        });
        (0, vitest_1.expect)(result.valid).toBe(false);
        (0, vitest_1.expect)(result.error?.error.message).toContain('max_tokens');
    });
    (0, vitest_1.it)('temperature=2.0 returns error', () => {
        const result = (0, request_validator_js_1.validateRequest)({
            model: 'claude-sonnet-4-20250514',
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 1024,
            temperature: 2.0,
        });
        (0, vitest_1.expect)(result.valid).toBe(false);
        (0, vitest_1.expect)(result.error?.error.message).toContain('temperature');
    });
});
// =============================================================================
// UT-03: Auth Resolver — Gateway mode (KSA-237)
// =============================================================================
(0, vitest_1.describe)('UT-03: resolveAuth follows gateway rules', () => {
    const tmpDir = path.join(os.tmpdir(), `kiro-ts-test-${Date.now()}`);
    (0, vitest_1.beforeEach)(() => {
        fs.mkdirSync(tmpDir, { recursive: true });
        (0, auth_resolver_js_1.setCredentialPathOverride)(null);
    });
    (0, vitest_1.afterEach)(() => {
        (0, auth_resolver_js_1.setCredentialPathOverride)(null);
        try {
            fs.rmSync(tmpDir, { recursive: true });
        }
        catch { }
    });
    (0, vitest_1.it)('passes through a REAL Anthropic key (sk-ant-...) when no Kiro token present', () => {
        // Point to a non-existent token file so no Kiro credentials are loaded
        (0, auth_resolver_js_1.setCredentialPathOverride)(path.join(tmpDir, 'nonexistent.json'));
        const result = (0, auth_resolver_js_1.resolveAuth)('sk-ant-test-key');
        (0, vitest_1.expect)(result.mode).toBe('api_key');
        (0, vitest_1.expect)(result.apiKey).toBe('sk-ant-test-key');
    });
    (0, vitest_1.it)('serves Kiro mode with a valid token even when client sends gateway key', () => {
        const tokenFile = path.join(tmpDir, 'kiro-auth-token.json');
        fs.writeFileSync(tokenFile, JSON.stringify({
            accessToken: 'kiro-access-token-abc',
            refreshToken: 'kiro-refresh-token-xyz',
            expiresAt: '2099-12-31T23:59:59Z',
            region: 'ap-southeast-1',
        }));
        (0, auth_resolver_js_1.setCredentialPathOverride)(tokenFile);
        (0, auth_resolver_js_1.initializeAuth)();
        const result = (0, auth_resolver_js_1.resolveAuth)((0, auth_resolver_js_1.getGatewayApiKey)());
        (0, vitest_1.expect)(result.mode).toBe('kiro');
        (0, vitest_1.expect)(result.bearerToken).toBe('kiro-access-token-abc');
        (0, vitest_1.expect)(result.region).toBe('ap-southeast-1');
        (0, vitest_1.expect)(result.refreshToken).toBe('kiro-refresh-token-xyz');
    });
    (0, vitest_1.it)('serves Kiro mode with empty key when token present', () => {
        const tokenFile = path.join(tmpDir, 'kiro-auth-token.json');
        fs.writeFileSync(tokenFile, JSON.stringify({
            accessToken: 'kiro-access-token-abc',
            expiresAt: '2099-12-31T23:59:59Z',
            region: 'us-east-1',
        }));
        (0, auth_resolver_js_1.setCredentialPathOverride)(tokenFile);
        (0, auth_resolver_js_1.initializeAuth)();
        const result = (0, auth_resolver_js_1.resolveAuth)('');
        (0, vitest_1.expect)(result.mode).toBe('kiro');
        (0, vitest_1.expect)(result.bearerToken).toBe('kiro-access-token-abc');
    });
    (0, vitest_1.it)('serves Kiro mode even when client sends a WRONG (non-anthropic) key', () => {
        const tokenFile = path.join(tmpDir, 'kiro-auth-token.json');
        fs.writeFileSync(tokenFile, JSON.stringify({
            accessToken: 'kiro-access-token-abc',
            expiresAt: '2099-12-31T23:59:59Z',
            region: 'us-east-1',
        }));
        (0, auth_resolver_js_1.setCredentialPathOverride)(tokenFile);
        (0, auth_resolver_js_1.initializeAuth)();
        const result = (0, auth_resolver_js_1.resolveAuth)('some-random-wrong-key');
        // Wrong key does NOT fall through to Anthropic passthrough — gateway serves Kiro.
        (0, vitest_1.expect)(result.mode).toBe('kiro');
        (0, vitest_1.expect)(result.bearerToken).toBe('kiro-access-token-abc');
    });
    (0, vitest_1.it)('honours bring-your-own real Anthropic key even when Kiro token present', () => {
        const tokenFile = path.join(tmpDir, 'kiro-auth-token.json');
        fs.writeFileSync(tokenFile, JSON.stringify({
            accessToken: 'kiro-access-token-abc',
            expiresAt: '2099-12-31T23:59:59Z',
            region: 'us-east-1',
        }));
        (0, auth_resolver_js_1.setCredentialPathOverride)(tokenFile);
        (0, auth_resolver_js_1.initializeAuth)();
        const result = (0, auth_resolver_js_1.resolveAuth)('sk-ant-my-own-key');
        (0, vitest_1.expect)(result.mode).toBe('api_key');
        (0, vitest_1.expect)(result.apiKey).toBe('sk-ant-my-own-key');
    });
    (0, vitest_1.it)('falls back to local-trusted api_key mode when no token and no header', () => {
        (0, auth_resolver_js_1.setCredentialPathOverride)(path.join(tmpDir, 'nonexistent.json'));
        const result = (0, auth_resolver_js_1.resolveAuth)('');
        // Implementation accepts local requests as trusted rather than throwing
        (0, vitest_1.expect)(result.mode).toBe('api_key');
    });
});
// =============================================================================
// UT-03b: Gateway API key — stable & persisted (KSA-237)
// =============================================================================
(0, vitest_1.describe)('UT-03b: getGatewayApiKey is stable', () => {
    (0, vitest_1.it)('returns a stable sk-kiro- key across calls', () => {
        const k1 = (0, auth_resolver_js_1.getGatewayApiKey)();
        const k2 = (0, auth_resolver_js_1.getGatewayApiKey)();
        (0, vitest_1.expect)(k1).toBe(k2);
        (0, vitest_1.expect)(k1.startsWith('sk-kiro-')).toBe(true);
    });
});
// =============================================================================
// UT-05: Conversation Store — Tool ID Tracking
// =============================================================================
(0, vitest_1.describe)('UT-05: ConversationStore indexes tool_use IDs', () => {
    (0, vitest_1.it)('indexes tool_use blocks from assistant messages', () => {
        const store = new conversation_store_js_1.ConversationStore();
        const session = store.getOrCreate('test-session');
        session.addAssistantMessage([
            { type: 'tool_use', id: 'toolu_abc', name: 'get_file', input: { path: '/x' } },
            { type: 'text', text: 'Let me read that file.' },
        ]);
        (0, vitest_1.expect)(session.findToolUse('toolu_abc')).toEqual({
            id: 'toolu_abc',
            name: 'get_file',
            input: { path: '/x' },
        });
        (0, vitest_1.expect)(session.findToolUse('nonexistent')).toBeNull();
        (0, vitest_1.expect)(session.getAllToolUseIds()).toContain('toolu_abc');
    });
});
// =============================================================================
// UT-06: Tool ID Mismatch Error
// =============================================================================
(0, vitest_1.describe)('UT-06: Tool ID mismatch produces descriptive error', () => {
    (0, vitest_1.it)('throws ToolIdMismatchError with available IDs', () => {
        const store = new conversation_store_js_1.ConversationStore();
        const session = store.getOrCreate('test-session');
        session.addAssistantMessage([
            { type: 'tool_use', id: 'toolu_A', name: 'tool_a', input: {} },
            { type: 'tool_use', id: 'toolu_B', name: 'tool_b', input: {} },
        ]);
        (0, vitest_1.expect)(() => session.addToolResult('toolu_WRONG', 'result', false))
            .toThrow(conversation_store_js_1.ToolIdMismatchError);
        try {
            session.addToolResult('toolu_WRONG', 'result', false);
        }
        catch (err) {
            const e = err;
            (0, vitest_1.expect)(e.receivedId).toBe('toolu_WRONG');
            (0, vitest_1.expect)(e.availableIds).toContain('toolu_A');
            (0, vitest_1.expect)(e.availableIds).toContain('toolu_B');
            (0, vitest_1.expect)(e.message).toContain('toolu_WRONG');
        }
    });
    (0, vitest_1.it)('valid tool result does not throw', () => {
        const store = new conversation_store_js_1.ConversationStore();
        const session = store.getOrCreate('test-session');
        session.addAssistantMessage([
            { type: 'tool_use', id: 'toolu_valid', name: 'tool', input: {} },
        ]);
        (0, vitest_1.expect)(() => session.addToolResult('toolu_valid', 'result', false)).not.toThrow();
    });
});
// =============================================================================
// UT-08: SSE Event Formatting
// =============================================================================
(0, vitest_1.describe)('UT-08: formatSSEEvent produces valid strings', () => {
    (0, vitest_1.it)('formats content_block_delta correctly', () => {
        const result = (0, stream_proxy_js_1.formatSSEEvent)('content_block_delta', {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: 'Hello' },
        });
        (0, vitest_1.expect)(result).toMatch(/^event: content_block_delta\n/);
        (0, vitest_1.expect)(result).toMatch(/\ndata: .+\n\n$/);
        // Parse data line
        const dataLine = result.split('\n')[1];
        const json = JSON.parse(dataLine.replace('data: ', ''));
        (0, vitest_1.expect)(json.type).toBe('content_block_delta');
        (0, vitest_1.expect)(json.delta.text).toBe('Hello');
    });
    (0, vitest_1.it)('formats message_stop correctly', () => {
        const result = (0, stream_proxy_js_1.formatSSEEvent)('message_stop', { type: 'message_stop' });
        (0, vitest_1.expect)(result).toBe('event: message_stop\ndata: {"type":"message_stop"}\n\n');
    });
});
// =============================================================================
// UT-10: SigV4 Signer
// =============================================================================
(0, vitest_1.describe)('UT-10: SigV4 signer produces correct signatures', () => {
    (0, vitest_1.it)('generates Authorization header with correct format', () => {
        const signed = (0, sigv4_signer_js_1.signRequest)({
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
        (0, vitest_1.expect)(signed.headers['Authorization']).toMatch(/^AWS4-HMAC-SHA256 Credential=ASIATESTKEY123456\/20260605\/us-east-1\/kiro\/aws4_request, SignedHeaders=.+, Signature=[a-f0-9]{64}$/);
        (0, vitest_1.expect)(signed.headers['x-amz-date']).toBe('20260605T120000Z');
        (0, vitest_1.expect)(signed.headers['x-amz-security-token']).toBe('testSessionToken');
        (0, vitest_1.expect)(signed.headers['x-amz-content-sha256']).toMatch(/^[a-f0-9]{64}$/);
    });
    (0, vitest_1.it)('omits x-amz-security-token when no session token', () => {
        const signed = (0, sigv4_signer_js_1.signRequest)({
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
        (0, vitest_1.expect)(signed.headers['x-amz-security-token']).toBeUndefined();
    });
    (0, vitest_1.it)('produces different signatures for different bodies', () => {
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
        const sig1 = (0, sigv4_signer_js_1.signRequest)({ ...opts, body: '{"a":1}' });
        const sig2 = (0, sigv4_signer_js_1.signRequest)({ ...opts, body: '{"b":2}' });
        const extractSig = (auth) => auth.split('Signature=')[1];
        (0, vitest_1.expect)(extractSig(sig1.headers['Authorization'])).not.toBe(extractSig(sig2.headers['Authorization']));
    });
});
// =============================================================================
// UT-11: API Region Auto-Detection (KSA-237)
// =============================================================================
const auth_resolver_js_2 = require("../auth-resolver.js");
(0, vitest_1.describe)('UT-11: resolveApiRegion / resolveApiRegionAsync', () => {
    const regionCachePath = path.join(os.homedir(), '.aws', 'sso', 'cache', 'kiro-ts-api-region');
    const savedEnv = process.env.KIRO_API_REGION;
    (0, vitest_1.beforeEach)(() => {
        delete process.env.KIRO_API_REGION;
        (0, auth_resolver_js_2.invalidateApiRegionCache)();
    });
    (0, vitest_1.afterEach)(() => {
        if (savedEnv === undefined) {
            delete process.env.KIRO_API_REGION;
        }
        else {
            process.env.KIRO_API_REGION = savedEnv;
        }
        (0, auth_resolver_js_2.invalidateApiRegionCache)();
    });
    (0, vitest_1.it)('explicit token.apiRegion takes top priority (sync + async)', async () => {
        const token = { accessToken: 'x', expiresAt: '2099-01-01T00:00:00Z', region: 'ap-southeast-1', apiRegion: 'eu-central-1' };
        (0, vitest_1.expect)((0, auth_resolver_js_2.resolveApiRegion)(token)).toBe('eu-central-1');
        (0, vitest_1.expect)(await (0, auth_resolver_js_2.resolveApiRegionAsync)(token)).toBe('eu-central-1');
    });
    (0, vitest_1.it)('env KIRO_API_REGION overrides probe when no token.apiRegion', async () => {
        process.env.KIRO_API_REGION = 'us-west-2';
        const token = { accessToken: 'x', expiresAt: '2099-01-01T00:00:00Z', region: 'ap-southeast-1' };
        (0, vitest_1.expect)((0, auth_resolver_js_2.resolveApiRegion)(token)).toBe('us-west-2');
        (0, vitest_1.expect)(await (0, auth_resolver_js_2.resolveApiRegionAsync)(token)).toBe('us-west-2');
    });
    (0, vitest_1.it)('sync resolveApiRegion returns default us-east-1 when no cache/explicit', () => {
        (0, vitest_1.expect)((0, auth_resolver_js_2.resolveApiRegion)(null)).toBe('us-east-1');
    });
    (0, vitest_1.it)('async probe resolves a real CodeWhisperer region and caches it', async () => {
        // q.{region}.amazonaws.com should resolve on any machine with internet.
        // The probe order starts with the SSO region then known regions; the
        // result is one of the candidate regions and gets cached.
        const token = { accessToken: 'x', expiresAt: '2099-01-01T00:00:00Z', region: 'us-east-1' };
        const region = await (0, auth_resolver_js_2.resolveApiRegionAsync)(token, { forceProbe: true });
        (0, vitest_1.expect)(typeof region).toBe('string');
        (0, vitest_1.expect)(region.length).toBeGreaterThan(0);
        // After a successful probe, the sync resolver returns the cached value.
        (0, vitest_1.expect)((0, auth_resolver_js_2.resolveApiRegion)(null)).toBe(region);
    });
    (0, vitest_1.it)('invalidateApiRegionCache clears in-memory + persisted cache', async () => {
        await (0, auth_resolver_js_2.resolveApiRegionAsync)({ accessToken: 'x', expiresAt: '2099-01-01T00:00:00Z', region: 'us-east-1' }, { forceProbe: true });
        (0, auth_resolver_js_2.invalidateApiRegionCache)();
        (0, vitest_1.expect)(fs.existsSync(regionCachePath)).toBe(false);
        // Sync resolver falls back to default after invalidation.
        (0, vitest_1.expect)((0, auth_resolver_js_2.resolveApiRegion)(null)).toBe('us-east-1');
    });
});
//# sourceMappingURL=kiro-ts.vitest.js.map