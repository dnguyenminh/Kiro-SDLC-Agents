"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
const vitest_1 = require("vitest");
const events_1 = require("events");
const index_js_1 = require("../adapters/index.js");
const kiro_adapter_js_1 = require("../adapters/kiro-adapter.js");
const anthropic_passthrough_adapter_js_1 = require("../adapters/anthropic-passthrough-adapter.js");
const models_handler_js_1 = require("../models-handler.js");
const kiro_converter_js_1 = require("../kiro-converter.js");
const auth_resolver_js_1 = require("../auth-resolver.js");
// ---------------------------------------------------------------------------
// Mock http.ServerResponse capture
// ---------------------------------------------------------------------------
class MockResponse extends events_1.EventEmitter {
    statusCode = 0;
    headers = {};
    body = '';
    headersSent = false;
    writeHead(status, headers) {
        this.statusCode = status;
        if (headers)
            this.headers = headers;
        this.headersSent = true;
        return this;
    }
    write(chunk) { this.body += chunk; return true; }
    end(chunk) { if (chunk)
        this.body += chunk; this.emit('finish'); return this; }
}
function mockReq(method, url, headers = {}) {
    const req = new events_1.EventEmitter();
    req.method = method;
    req.url = url;
    req.headers = headers;
    return req;
}
// ===========================================================================
// selectAdapter factory — UT-03 (auth.mode selection)
// ===========================================================================
(0, vitest_1.describe)('selectAdapter factory', () => {
    (0, vitest_1.it)('returns KiroAdapter for kiro mode', () => {
        const auth = {
            mode: 'kiro',
            bearerToken: 'tok',
            region: 'us-east-1',
        };
        const adapter = (0, index_js_1.selectAdapter)(auth);
        (0, vitest_1.expect)(adapter).toBeInstanceOf(kiro_adapter_js_1.KiroAdapter);
        (0, vitest_1.expect)(adapter.name).toBe('kiro');
    });
    (0, vitest_1.it)('returns AnthropicPassthroughAdapter for api_key mode', () => {
        const auth = { mode: 'api_key', apiKey: 'sk-ant-xyz' };
        const adapter = (0, index_js_1.selectAdapter)(auth);
        (0, vitest_1.expect)(adapter).toBeInstanceOf(anthropic_passthrough_adapter_js_1.AnthropicPassthroughAdapter);
        (0, vitest_1.expect)(adapter.name).toBe('anthropic-passthrough');
    });
});
// ===========================================================================
// KiroAdapter.listModels — source of truth
// ===========================================================================
(0, vitest_1.describe)('KiroAdapter.listModels', () => {
    (0, vitest_1.it)('returns the canonical Kiro model list', async () => {
        const adapter = new kiro_adapter_js_1.KiroAdapter({ mode: 'kiro' });
        const models = await adapter.listModels();
        const ids = models.map((m) => m.id);
        (0, vitest_1.expect)(ids).toContain('claude-sonnet-4-5');
        (0, vitest_1.expect)(ids).toContain('claude-sonnet-4-6');
        (0, vitest_1.expect)(ids).toContain('claude-opus-4-5');
        (0, vitest_1.expect)(ids).toContain('claude-opus-4-6');
        (0, vitest_1.expect)(ids).toContain('claude-opus-4-7');
        (0, vitest_1.expect)(ids).toContain('claude-opus-4-8');
        (0, vitest_1.expect)(ids).toContain('claude-haiku-4-5');
    });
    (0, vitest_1.it)('every listed model has type=model, id, display_name', async () => {
        const adapter = new kiro_adapter_js_1.KiroAdapter({ mode: 'kiro' });
        const models = await adapter.listModels();
        for (const m of models) {
            (0, vitest_1.expect)(m.type).toBe('model');
            (0, vitest_1.expect)(typeof m.id).toBe('string');
            (0, vitest_1.expect)(m.id.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(typeof m.display_name).toBe('string');
            (0, vitest_1.expect)(m.display_name.length).toBeGreaterThan(0);
        }
    });
    (0, vitest_1.it)('every Kiro model id maps via kiro-converter mapModel', async () => {
        const adapter = new kiro_adapter_js_1.KiroAdapter({ mode: 'kiro' });
        const models = await adapter.listModels();
        for (const m of models) {
            // mapModel must resolve (non-null) for the gateway to accept the model.
            (0, vitest_1.expect)((0, kiro_converter_js_1.mapModel)(m.id)).not.toBeNull();
        }
    });
});
// ===========================================================================
// AnthropicPassthroughAdapter.listModels — fallback when no key
// ===========================================================================
(0, vitest_1.describe)('AnthropicPassthroughAdapter.listModels', () => {
    (0, vitest_1.it)('returns static fallback when no key', async () => {
        const adapter = new anthropic_passthrough_adapter_js_1.AnthropicPassthroughAdapter(undefined);
        const models = await adapter.listModels();
        (0, vitest_1.expect)(models).toEqual(anthropic_passthrough_adapter_js_1.ANTHROPIC_FALLBACK_MODELS);
    });
    (0, vitest_1.it)('returns static fallback for local-trusted placeholder', async () => {
        const adapter = new anthropic_passthrough_adapter_js_1.AnthropicPassthroughAdapter('local-trusted');
        const models = await adapter.listModels();
        (0, vitest_1.expect)(models.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(models[0].type).toBe('model');
    });
});
// ===========================================================================
// buildModelsListResponse — Anthropic /v1/models envelope
// ===========================================================================
(0, vitest_1.describe)('buildModelsListResponse', () => {
    (0, vitest_1.it)('wraps models with pagination metadata', () => {
        const models = [
            { type: 'model', id: 'a', display_name: 'A' },
            { type: 'model', id: 'b', display_name: 'B' },
        ];
        const resp = (0, index_js_1.buildModelsListResponse)(models);
        (0, vitest_1.expect)(resp.data).toHaveLength(2);
        (0, vitest_1.expect)(resp.has_more).toBe(false);
        (0, vitest_1.expect)(resp.first_id).toBe('a');
        (0, vitest_1.expect)(resp.last_id).toBe('b');
    });
    (0, vitest_1.it)('handles empty list', () => {
        const resp = (0, index_js_1.buildModelsListResponse)([]);
        (0, vitest_1.expect)(resp.data).toHaveLength(0);
        (0, vitest_1.expect)(resp.first_id).toBeNull();
        (0, vitest_1.expect)(resp.last_id).toBeNull();
    });
});
// ===========================================================================
// models-handler routing + response format
// ===========================================================================
(0, vitest_1.describe)('handleModelsRoute', () => {
    (0, vitest_1.beforeEach)(() => {
        // Force no Kiro credentials -> Anthropic fallback (deterministic, no network).
        (0, auth_resolver_js_1.setCredentialPathOverride)('/nonexistent/kiro-token.json');
    });
    (0, vitest_1.afterEach)(() => {
        (0, auth_resolver_js_1.setCredentialPathOverride)(null);
    });
    (0, vitest_1.it)('ignores non-GET methods', () => {
        const res = new MockResponse();
        const handled = (0, models_handler_js_1.handleModelsRoute)(mockReq('POST', '/v1/models'), res);
        (0, vitest_1.expect)(handled).toBe(false);
    });
    (0, vitest_1.it)('ignores unrelated paths', () => {
        const res = new MockResponse();
        const handled = (0, models_handler_js_1.handleModelsRoute)(mockReq('GET', '/v1/messages'), res);
        (0, vitest_1.expect)(handled).toBe(false);
    });
    (0, vitest_1.it)('handles GET /v1/models with Anthropic format response', async () => {
        const res = new MockResponse();
        const handled = (0, models_handler_js_1.handleModelsRoute)(mockReq('GET', '/v1/models'), res);
        (0, vitest_1.expect)(handled).toBe(true);
        await new Promise((resolve) => res.once('finish', resolve));
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        const payload = JSON.parse(res.body);
        (0, vitest_1.expect)(Array.isArray(payload.data)).toBe(true);
        (0, vitest_1.expect)(payload.data.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(payload).toHaveProperty('has_more');
        (0, vitest_1.expect)(payload).toHaveProperty('first_id');
        (0, vitest_1.expect)(payload).toHaveProperty('last_id');
        for (const m of payload.data) {
            (0, vitest_1.expect)(m.type).toBe('model');
            (0, vitest_1.expect)(m).toHaveProperty('id');
            (0, vitest_1.expect)(m).toHaveProperty('display_name');
        }
    });
    (0, vitest_1.it)('handles the /anthropic/v1/models prefixed path (after router strip)', async () => {
        // The router strips /anthropic, but the handler also tolerates it directly.
        const res = new MockResponse();
        const handled = (0, models_handler_js_1.handleModelsRoute)(mockReq('GET', '/anthropic/v1/models'), res);
        (0, vitest_1.expect)(handled).toBe(true);
        await new Promise((resolve) => res.once('finish', resolve));
        (0, vitest_1.expect)(res.statusCode).toBe(200);
        const payload = JSON.parse(res.body);
        (0, vitest_1.expect)(Array.isArray(payload.data)).toBe(true);
    });
    (0, vitest_1.it)('handles query string on /v1/models?limit=100', async () => {
        const res = new MockResponse();
        const handled = (0, models_handler_js_1.handleModelsRoute)(mockReq('GET', '/v1/models?limit=100'), res);
        (0, vitest_1.expect)(handled).toBe(true);
        await new Promise((resolve) => res.once('finish', resolve));
        (0, vitest_1.expect)(res.statusCode).toBe(200);
    });
});
//# sourceMappingURL=adapters.vitest.js.map