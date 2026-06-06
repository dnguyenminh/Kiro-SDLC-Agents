"use strict";
/**
 * Anthropic Passthrough Adapter — KSA-237 (Adapter Pattern)
 *
 * Implements LLMBackendAdapter for the bring-your-own-key path: forwards the
 * Anthropic request directly to api.anthropic.com using the client's
 * x-api-key. Used when the gateway has no Kiro SSO credentials, or when the
 * client explicitly supplies a real `sk-ant-` key.
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
exports.AnthropicPassthroughAdapter = exports.ANTHROPIC_FALLBACK_MODELS = void 0;
exports.fetchAnthropicModels = fetchAnthropicModels;
const https = __importStar(require("https"));
const stream_proxy_js_1 = require("../stream-proxy.js");
const adapter_utils_js_1 = require("./adapter-utils.js");
const ANTHROPIC_API_BASE = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';
/**
 * Static fallback models served when no key is available or the upstream
 * `/v1/models` call fails. Mirrors the commonly-available Anthropic models.
 */
exports.ANTHROPIC_FALLBACK_MODELS = [
    { type: 'model', id: 'claude-opus-4-1-20250805', display_name: 'Claude Opus 4.1', created_at: '2025-08-05T00:00:00Z' },
    { type: 'model', id: 'claude-sonnet-4-5-20250929', display_name: 'Claude Sonnet 4.5', created_at: '2025-09-29T00:00:00Z' },
    { type: 'model', id: 'claude-sonnet-4-20250514', display_name: 'Claude Sonnet 4', created_at: '2025-05-14T00:00:00Z' },
    { type: 'model', id: 'claude-haiku-4-5-20251001', display_name: 'Claude Haiku 4.5', created_at: '2025-10-01T00:00:00Z' },
    { type: 'model', id: 'claude-3-5-sonnet-20241022', display_name: 'Claude Sonnet 3.5', created_at: '2024-10-22T00:00:00Z' },
];
class AnthropicPassthroughAdapter {
    name = 'anthropic-passthrough';
    apiKey;
    options;
    constructor(apiKey, options = {}) {
        this.apiKey = apiKey;
        this.options = options;
    }
    async listModels() {
        // No real key (or only the local-trusted placeholder) -> static fallback.
        if (!this.apiKey || this.apiKey === 'local-trusted') {
            return exports.ANTHROPIC_FALLBACK_MODELS;
        }
        try {
            const models = await fetchAnthropicModels(this.apiKey);
            return models.length > 0 ? models : exports.ANTHROPIC_FALLBACK_MODELS;
        }
        catch (err) {
            console.error('[kiro-ts] Anthropic /v1/models fetch failed, using fallback:', err.message);
            return exports.ANTHROPIC_FALLBACK_MODELS;
        }
    }
    async createMessage(request, res, stream) {
        const upstreamBody = this.options.buildBody
            ? this.options.buildBody(request)
            : defaultBuildBody(request);
        const targetUrl = `${ANTHROPIC_API_BASE}/v1/messages`;
        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey || '',
            'anthropic-version': ANTHROPIC_VERSION,
        };
        const bodyStr = JSON.stringify(upstreamBody);
        if (stream) {
            (0, stream_proxy_js_1.proxyStream)({ targetUrl, headers, body: bodyStr }, res, (contentBlocks) => {
                const blocks = extractContentBlocks(contentBlocks);
                if (blocks.length > 0)
                    this.options.onComplete?.(blocks);
            }, (err) => {
                if (!res.headersSent) {
                    if (err instanceof stream_proxy_js_1.UpstreamError) {
                        (0, adapter_utils_js_1.sendError)(res, err.statusCode, 'api_error', err.message);
                    }
                    else {
                        (0, adapter_utils_js_1.sendError)(res, 502, 'api_error', 'Failed to connect to AI service');
                    }
                }
            });
        }
        else {
            try {
                const upstream = await (0, stream_proxy_js_1.proxyNonStreaming)({ targetUrl, headers, body: bodyStr });
                if (upstream.status >= 400) {
                    res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
                    res.end(upstream.body);
                    return;
                }
                const response = JSON.parse(upstream.body);
                if (response.content)
                    this.options.onComplete?.(response.content);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(upstream.body);
            }
            catch (err) {
                (0, adapter_utils_js_1.sendError)(res, 502, 'api_error', err.message || 'Failed to connect to AI service');
            }
        }
    }
}
exports.AnthropicPassthroughAdapter = AnthropicPassthroughAdapter;
/** Default body builder when chat-handler does not supply one. */
function defaultBuildBody(request) {
    const body = {
        model: request.model,
        max_tokens: request.max_tokens,
        messages: request.messages,
        stream: request.stream !== false,
    };
    if (request.system)
        body.system = request.system;
    if (request.temperature !== undefined)
        body.temperature = request.temperature;
    if (request.tools && request.tools.length > 0)
        body.tools = request.tools;
    if (request.tool_choice)
        body.tool_choice = request.tool_choice;
    if (request.stop_sequences && request.stop_sequences.length > 0)
        body.stop_sequences = request.stop_sequences;
    if (request.metadata)
        body.metadata = request.metadata;
    return body;
}
/** Extract content blocks from collected streaming events. */
function extractContentBlocks(streamData) {
    const blocks = [];
    const blockMap = new Map();
    for (const item of streamData) {
        const event = item;
        if (event.type === 'content_block_start' && event.content_block) {
            const block = { type: event.content_block.type };
            if (event.content_block.type === 'tool_use') {
                block.id = event.content_block.id;
                block.name = event.content_block.name;
                block.input = {};
            }
            else if (event.content_block.type === 'text') {
                block.text = '';
            }
            blockMap.set(event.index, block);
        }
        else if (event.type === 'content_block_delta' && event.delta) {
            const block = blockMap.get(event.index);
            if (block) {
                if (event.delta.type === 'text_delta' && event.delta.text) {
                    block.text = (block.text || '') + event.delta.text;
                }
                else if (event.delta.type === 'input_json_delta' && event.delta.partial_json) {
                    try {
                        block.input = JSON.parse(event.delta.partial_json);
                    }
                    catch {
                        // Partial JSON — accumulate (best effort)
                    }
                }
            }
        }
    }
    for (const [, block] of blockMap)
        blocks.push(block);
    return blocks;
}
/**
 * GET https://api.anthropic.com/v1/models using the supplied key. Maps the
 * response to AnthropicModel[]. Throws on non-2xx or network failure.
 */
function fetchAnthropicModels(apiKey) {
    return new Promise((resolve, reject) => {
        const reqOptions = {
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
                    const models = data.map((m) => ({
                        type: 'model',
                        id: m.id,
                        display_name: m.display_name || m.id,
                        created_at: m.created_at,
                    }));
                    resolve(models);
                }
                catch (err) {
                    reject(new Error('Failed to parse Anthropic models response'));
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(5000, () => { req.destroy(); reject(new Error('Anthropic models request timeout')); });
        req.end();
    });
}
//# sourceMappingURL=anthropic-passthrough-adapter.js.map