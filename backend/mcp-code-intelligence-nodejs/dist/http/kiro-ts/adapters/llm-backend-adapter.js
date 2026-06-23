"use strict";
/**
 * LLM Backend Adapter — KSA-237 (Adapter Pattern)
 *
 * kiro-ts is a WRAPPER that exposes the standard Anthropic API to external
 * agents (Cline, Roo Code, Cursor, Claude Code...). Behind the scenes the
 * real backend is either Kiro SSO -> CodeWhisperer or a direct passthrough to
 * api.anthropic.com. Clients only ever see the Anthropic API.
 *
 * The Adapter pattern provides a uniform interface (`LLMBackendAdapter`) over
 * these heterogeneous backends so the route handlers (chat-handler,
 * models-handler) stay backend-agnostic.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildModelsListResponse = buildModelsListResponse;
/**
 * Build the Anthropic `/v1/models` list envelope from a flat model array.
 * Mirrors the pagination shape Anthropic returns (has_more / first_id / last_id).
 */
function buildModelsListResponse(models) {
    return {
        data: models,
        has_more: false,
        first_id: models.length > 0 ? models[0].id : null,
        last_id: models.length > 0 ? models[models.length - 1].id : null,
    };
}
//# sourceMappingURL=llm-backend-adapter.js.map