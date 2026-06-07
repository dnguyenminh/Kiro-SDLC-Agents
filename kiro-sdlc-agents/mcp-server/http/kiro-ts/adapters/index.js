"use strict";
/**
 * Adapter Factory — KSA-237 (Adapter Pattern)
 *
 * Selects the right LLMBackendAdapter for a resolved auth context:
 *   - auth.mode === 'kiro'    -> KiroAdapter (SSO -> CodeWhisperer)
 *   - auth.mode === 'api_key' -> AnthropicPassthroughAdapter (BYO key)
 *
 * Adapter construction is cheap; callers create one per request so per-request
 * options (session history, onComplete) can be injected.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAnthropicModels = exports.ANTHROPIC_FALLBACK_MODELS = exports.AnthropicPassthroughAdapter = exports.KIRO_MODELS = exports.KiroAdapter = exports.buildModelsListResponse = void 0;
exports.selectAdapter = selectAdapter;
const kiro_adapter_js_1 = require("./kiro-adapter.js");
const anthropic_passthrough_adapter_js_1 = require("./anthropic-passthrough-adapter.js");
/**
 * Build the backend adapter for a resolved auth context.
 *
 * @param auth    resolved auth (mode + credentials)
 * @param options per-request options (message history, body builder, onComplete)
 */
function selectAdapter(auth, options = {}) {
    if (auth.mode === 'kiro') {
        return new kiro_adapter_js_1.KiroAdapter(auth, {
            messages: options.messages,
            onComplete: options.onComplete,
        });
    }
    // api_key mode -> Anthropic passthrough (apiKey may be undefined/local-trusted)
    return new anthropic_passthrough_adapter_js_1.AnthropicPassthroughAdapter(auth.apiKey, {
        buildBody: options.buildBody,
        onComplete: options.onComplete,
    });
}
var llm_backend_adapter_js_1 = require("./llm-backend-adapter.js");
Object.defineProperty(exports, "buildModelsListResponse", { enumerable: true, get: function () { return llm_backend_adapter_js_1.buildModelsListResponse; } });
var kiro_adapter_js_2 = require("./kiro-adapter.js");
Object.defineProperty(exports, "KiroAdapter", { enumerable: true, get: function () { return kiro_adapter_js_2.KiroAdapter; } });
Object.defineProperty(exports, "KIRO_MODELS", { enumerable: true, get: function () { return kiro_adapter_js_2.KIRO_MODELS; } });
var anthropic_passthrough_adapter_js_2 = require("./anthropic-passthrough-adapter.js");
Object.defineProperty(exports, "AnthropicPassthroughAdapter", { enumerable: true, get: function () { return anthropic_passthrough_adapter_js_2.AnthropicPassthroughAdapter; } });
Object.defineProperty(exports, "ANTHROPIC_FALLBACK_MODELS", { enumerable: true, get: function () { return anthropic_passthrough_adapter_js_2.ANTHROPIC_FALLBACK_MODELS; } });
Object.defineProperty(exports, "fetchAnthropicModels", { enumerable: true, get: function () { return anthropic_passthrough_adapter_js_2.fetchAnthropicModels; } });
//# sourceMappingURL=index.js.map