"use strict";
/**
 * Kiro Models Client — KSA-237
 *
 * Fetches the REAL list of models available to the logged-in Kiro user from
 * the CodeWhisperer/Q backend, so the gateway `/v1/models` (and therefore the
 * Settings panel + Chat box) shows EXACTLY the same models as Kiro IDE.
 *
 * ── How the endpoint was discovered ────────────────────────────────────────
 * Kiro IDE itself does not expose a public REST `/v1/models`. The chat traffic
 * goes to `q.{region}.amazonaws.com/generateAssistantResponse` (AWS JSON-RPC
 * 1.0 over the `AmazonCodeWhispererService` target). Probing that service for
 * target operations revealed:
 *
 *   X-Amz-Target: AmazonCodeWhispererService.ListAvailableModels
 *   body:         {"origin":"AI_EDITOR"}
 *   -> HTTP 200 { defaultModel: {...}, models: [ { modelId, modelName, ... } ] }
 *
 * (Operations `ListModels` / `ListFoundationModels` return UnknownOperation —
 * only `ListAvailableModels` exists. The previously-used host
 * `kiro.api.{region}.amazonaws.com` does NOT resolve in DNS and is dead.)
 *
 * This call uses the same bearer token + KiroIDE User-Agent headers as
 * generateAssistantResponse, so it succeeds whenever chat succeeds. Empty body
 * is rejected (400 "Improperly formed request"); `{"origin":"AI_EDITOR"}` is
 * required.
 *
 * Network failures, auth failures, or unexpected payloads make the caller fall
 * back to the static KIRO_MODELS list.
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
exports.fetchKiroModels = fetchKiroModels;
exports.mapKiroApiModels = mapKiroApiModels;
const https = __importStar(require("https"));
const kiro_adapter_js_1 = require("./adapters/kiro-adapter.js");
/** AWS JSON-RPC 1.0 target for the CodeWhisperer model-listing operation. */
const LIST_MODELS_TARGET = 'AmazonCodeWhispererService.ListAvailableModels';
/** Short timeout — model listing must not block the Settings/Chat UI. */
const LIST_MODELS_TIMEOUT_MS = 8000;
/**
 * Call ListAvailableModels against `q.{region}.amazonaws.com` using the Kiro
 * bearer token. Returns the parsed model list mapped to AnthropicModel[], or
 * throws on any network / auth / parse failure so the caller can fall back.
 *
 * @param region      resolved CodeWhisperer API region (from resolveApiRegionAsync)
 * @param bearerToken Kiro SSO access token
 * @param machineId   stable KiroIDE machine id (resolveMachineId)
 */
function fetchKiroModels(region, bearerToken, machineId) {
    return new Promise((resolve, reject) => {
        const host = `q.${region}.amazonaws.com`;
        // Reuse the exact KiroIDE headers used by generateAssistantResponse, then
        // switch the content-type + target to the JSON-RPC model-listing op.
        const headers = {
            ...(0, kiro_adapter_js_1.buildKiroHeaders)(host, bearerToken, machineId),
            'Content-Type': 'application/x-amz-json-1.0',
            'X-Amz-Target': LIST_MODELS_TARGET,
        };
        // The empty body is rejected; origin AI_EDITOR mirrors Kiro IDE.
        const body = JSON.stringify({ origin: 'AI_EDITOR' });
        const reqOptions = {
            hostname: host,
            port: 443,
            path: '/',
            method: 'POST',
            headers: {
                ...headers,
                'Content-Length': Buffer.byteLength(body),
            },
        };
        const req = https.request(reqOptions, (resp) => {
            let raw = '';
            resp.on('data', (c) => { raw += c.toString(); });
            resp.on('end', () => {
                const status = resp.statusCode || 500;
                if (status >= 400) {
                    reject(new Error(`ListAvailableModels HTTP ${status}`));
                    return;
                }
                try {
                    const parsed = JSON.parse(raw);
                    const models = mapKiroApiModels(parsed);
                    if (models.length === 0) {
                        reject(new Error('ListAvailableModels returned no models'));
                        return;
                    }
                    resolve(models);
                }
                catch {
                    reject(new Error('Failed to parse ListAvailableModels response'));
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(LIST_MODELS_TIMEOUT_MS, () => {
            req.destroy();
            reject(new Error('ListAvailableModels request timeout'));
        });
        req.write(body);
        req.end();
    });
}
/**
 * Map the CodeWhisperer ListAvailableModels payload to the Anthropic
 * `/v1/models` model shape. Filters out entries without a usable modelId.
 *
 * The synthetic `auto` model (Kiro's task-router) is preserved — Kiro IDE shows
 * it and the gateway/converter accepts it (mapModel falls back gracefully).
 */
function mapKiroApiModels(payload) {
    const list = Array.isArray(payload?.models) ? payload.models : [];
    const out = [];
    for (const m of list) {
        const id = typeof m?.modelId === 'string' ? m.modelId.trim() : '';
        if (!id)
            continue;
        const entry = {
            type: 'model',
            id,
            display_name: (typeof m?.modelName === 'string' && m.modelName.trim()) || id,
        };
        // KSA-237: pass through description + rateMultiplier so the UI can render
        // them like Kiro IDE (model name + description + credits badge).
        if (typeof m?.description === 'string' && m.description.trim()) {
            entry.description = m.description.trim();
        }
        if (typeof m?.rateMultiplier === 'number') {
            entry.rate_multiplier = m.rateMultiplier;
        }
        out.push(entry);
    }
    return out;
}
//# sourceMappingURL=kiro-models-client.js.map