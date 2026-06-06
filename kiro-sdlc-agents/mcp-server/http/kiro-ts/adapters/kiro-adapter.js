"use strict";
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
exports.KiroAdapter = exports.KIRO_MODELS = void 0;
exports.buildKiroHeaders = buildKiroHeaders;
exports.collectBlocksFromSse = collectBlocksFromSse;
exports.buildMessageFromSse = buildMessageFromSse;
const https = __importStar(require("https"));
const os = __importStar(require("os"));
const crypto = __importStar(require("crypto"));
const auth_resolver_js_1 = require("../auth-resolver.js");
const kiro_converter_js_1 = require("../kiro-converter.js");
const event_stream_parser_js_1 = require("../event-stream-parser.js");
const kiro_stream_js_1 = require("../kiro-stream.js");
const machine_id_js_1 = require("../machine-id.js");
const kiro_config_js_1 = require("../kiro-config.js");
const kiro_models_client_js_1 = require("../kiro-models-client.js");
const stream_proxy_js_1 = require("../stream-proxy.js");
const adapter_utils_js_1 = require("./adapter-utils.js");
/**
 * Canonical list of Kiro-supported models. Each maps (via kiro-converter
 * `mapModel`) to a Kiro model family. These ids MUST contain the family
 * keyword (sonnet/opus/haiku) and version so mapModel resolves correctly.
 *
 * This is the SINGLE SOURCE OF TRUTH for the Kiro model list — the Settings
 * panel AVAILABLE_MODELS.kiro must mirror these ids.
 */
exports.KIRO_MODELS = [
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
class KiroAdapter {
    name = 'kiro';
    auth;
    options;
    constructor(auth, options = {}) {
        this.auth = auth;
        this.options = options;
    }
    async listModels() {
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
                const region = await (0, auth_resolver_js_1.resolveApiRegionAsync)(null);
                const machineId = (0, machine_id_js_1.resolveMachineId)({
                    seed: this.auth.refreshToken || this.auth.bearerToken || null,
                });
                const live = await (0, kiro_models_client_js_1.fetchKiroModels)(region, this.auth.bearerToken, machineId);
                if (live.length > 0) {
                    return live.map((m) => ({ ...m, created_at: m.created_at ?? KIRO_MODELS_CREATED_AT }));
                }
            }
            catch (err) {
                console.error('[kiro-ts] ListAvailableModels failed, falling back to static KIRO_MODELS:', err.message);
            }
        }
        return exports.KIRO_MODELS.map((m) => ({ ...m, created_at: m.created_at ?? KIRO_MODELS_CREATED_AT }));
    }
    async createMessage(request, res, stream) {
        // Resolve the CodeWhisperer API region (cached after first probe).
        const region = await (0, auth_resolver_js_1.resolveApiRegionAsync)(null);
        const host = `q.${region}.amazonaws.com`;
        const targetUrl = `https://${host}/generateAssistantResponse`;
        // Convert the (full-history) Anthropic request to conversationState. Use
        // the session's accumulated messages when provided so tool-result
        // continuations work; otherwise fall back to the request's own messages.
        const requestForConversion = {
            ...request,
            messages: this.options.messages ?? request.messages,
        };
        let conversionResult;
        try {
            conversionResult = (0, kiro_converter_js_1.convertRequest)(requestForConversion);
        }
        catch (err) {
            if (err instanceof kiro_converter_js_1.ConversionError) {
                (0, adapter_utils_js_1.sendError)(res, 400, 'invalid_request_error', err.message);
            }
            else {
                (0, adapter_utils_js_1.sendError)(res, 500, 'api_error', 'Failed to build upstream request');
            }
            return;
        }
        // Inject profileArn at the root when available (kiro.rs behavior).
        const bodyObj = {
            conversationState: conversionResult.conversationState,
        };
        if (this.auth.profileArn) {
            bodyObj.profileArn = this.auth.profileArn;
        }
        const bodyStr = JSON.stringify(bodyObj);
        const machineId = (0, machine_id_js_1.resolveMachineId)({
            seed: this.auth.refreshToken || this.auth.bearerToken || null,
        });
        const headers = buildKiroHeaders(host, this.auth.bearerToken || '', machineId);
        this.proxyKiroStream({ targetUrl, headers, body: bodyStr }, res, request.model, stream, (blocks) => {
            if (blocks.length > 0)
                this.options.onComplete?.(blocks);
        });
    }
    /**
     * Send the conversationState request to generateAssistantResponse, parse the
     * AWS Event Stream binary frames, convert them to Anthropic SSE, and either
     * stream them to the client or aggregate them into a single JSON response.
     */
    proxyKiroStream(options, clientRes, model, stream, onComplete) {
        const parsedUrl = new URL(options.targetUrl);
        const reqOptions = {
            hostname: parsedUrl.hostname,
            port: 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'POST',
            headers: {
                ...options.headers,
                'Content-Length': Buffer.byteLength(options.body),
            },
        };
        const decoder = new event_stream_parser_js_1.EventStreamDecoder();
        const converter = new kiro_stream_js_1.KiroStreamConverter(model);
        const allEvents = [];
        let started = false;
        let streamHeadersWritten = false;
        const writeSse = (events) => {
            if (events.length === 0)
                return;
            allEvents.push(...events);
            if (stream) {
                if (!streamHeadersWritten) {
                    (0, stream_proxy_js_1.writeSSEHeaders)(clientRes);
                    streamHeadersWritten = true;
                }
                for (const ev of events) {
                    clientRes.write((0, stream_proxy_js_1.formatSSEEvent)(ev.event, ev.data));
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
                        (0, adapter_utils_js_1.sendError)(clientRes, statusCode, 'api_error', `Kiro API error ${statusCode}: ${errBody.substring(0, 500)}`);
                    }
                    else {
                        clientRes.write((0, stream_proxy_js_1.formatSSEEvent)('error', {
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
            upstreamRes.on('data', (chunk) => {
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
                }
                else {
                    const message = buildMessageFromSse(allEvents, model);
                    clientRes.writeHead(200, { 'Content-Type': 'application/json' });
                    clientRes.end(JSON.stringify(message));
                }
            });
            upstreamRes.on('error', (err) => {
                if (!clientRes.headersSent) {
                    (0, adapter_utils_js_1.sendError)(clientRes, 502, 'api_error', 'Kiro stream error: ' + err.message);
                }
                else {
                    clientRes.write((0, stream_proxy_js_1.formatSSEEvent)('error', {
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
                (0, adapter_utils_js_1.sendError)(clientRes, 502, 'api_error', 'Failed to connect to Kiro AI service: ' + err.message);
            }
        });
        upstreamReq.setTimeout(120000, () => {
            upstreamReq.destroy();
            if (!clientRes.headersSent) {
                (0, adapter_utils_js_1.sendError)(clientRes, 504, 'api_error', 'Kiro upstream timeout');
            }
        });
        upstreamReq.write(options.body);
        upstreamReq.end();
    }
}
exports.KiroAdapter = KiroAdapter;
/**
 * Build the KiroIDE User-Agent headers used by generateAssistantResponse.
 * Mirrors kiro.rs `src/kiro/endpoint/ide.rs`.
 */
function buildKiroHeaders(host, bearerToken, machineId) {
    const systemVersion = `${os.platform()}_${os.release()}`;
    const xAmzUserAgent = `aws-sdk-js/1.0.34 KiroIDE-${kiro_config_js_1.KIRO_VERSION}-${machineId}`;
    const userAgent = `aws-sdk-js/1.0.34 ua/2.1 os/${systemVersion} lang/js md/nodejs#${kiro_config_js_1.NODE_VERSION} ` +
        `api/codewhispererstreaming#1.0.34 m/E KiroIDE-${kiro_config_js_1.KIRO_VERSION}-${machineId}`;
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
function collectBlocksFromSse(events) {
    const blockMap = new Map();
    const partialJson = new Map();
    for (const ev of events) {
        const data = ev.data;
        if (ev.event === 'content_block_start' && data.content_block) {
            const block = { type: data.content_block.type };
            if (data.content_block.type === 'tool_use') {
                block.id = data.content_block.id;
                block.name = data.content_block.name;
                block.input = {};
            }
            else if (data.content_block.type === 'text') {
                block.text = '';
            }
            blockMap.set(data.index, block);
        }
        else if (ev.event === 'content_block_delta' && data.delta) {
            const block = blockMap.get(data.index);
            if (block) {
                if (data.delta.type === 'text_delta' && data.delta.text) {
                    block.text = (block.text || '') + data.delta.text;
                }
                else if (data.delta.type === 'input_json_delta' && data.delta.partial_json) {
                    partialJson.set(data.index, (partialJson.get(data.index) || '') + data.delta.partial_json);
                }
            }
        }
    }
    const blocks = [];
    for (const [index, block] of blockMap) {
        if (block.type === 'tool_use') {
            const pj = partialJson.get(index);
            if (pj) {
                try {
                    block.input = JSON.parse(pj);
                }
                catch {
                    block.input = {};
                }
            }
        }
        blocks.push(block);
    }
    return blocks;
}
/** Build a single Anthropic message JSON from collected SSE events (non-streaming). */
function buildMessageFromSse(events, model) {
    const content = collectBlocksFromSse(events);
    let stopReason = 'end_turn';
    let outputTokens = 0;
    for (const ev of events) {
        if (ev.event === 'message_delta') {
            const data = ev.data;
            if (data.delta?.stop_reason)
                stopReason = data.delta.stop_reason;
            if (data.usage?.output_tokens)
                outputTokens = data.usage.output_tokens;
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
//# sourceMappingURL=kiro-adapter.js.map