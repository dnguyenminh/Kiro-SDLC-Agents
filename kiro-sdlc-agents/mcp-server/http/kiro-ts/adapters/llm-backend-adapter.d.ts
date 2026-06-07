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
import * as http from 'http';
import { AnthropicRequest } from '../types.js';
/**
 * A single model entry in the Anthropic `/v1/models` response format.
 * @see https://docs.anthropic.com/en/api/models-list
 */
export interface AnthropicModel {
    type: 'model';
    id: string;
    display_name: string;
    created_at?: string;
}
/**
 * Uniform interface implemented by every LLM backend. Each adapter translates
 * the Anthropic-shaped request/response to/from its underlying backend.
 */
export interface LLMBackendAdapter {
    /** Stable identifier for logging / diagnostics (e.g. "kiro", "anthropic-passthrough"). */
    readonly name: string;
    /** List available models in Anthropic `/v1/models` format. */
    listModels(): Promise<AnthropicModel[]>;
    /**
     * Handle an Anthropic Messages request, writing the Anthropic response
     * (single JSON when `stream=false`, or SSE stream when `stream=true`) to
     * `res`. The adapter owns the full response lifecycle.
     */
    createMessage(req: AnthropicRequest, res: http.ServerResponse, stream: boolean): Promise<void>;
}
/**
 * Build the Anthropic `/v1/models` list envelope from a flat model array.
 * Mirrors the pagination shape Anthropic returns (has_more / first_id / last_id).
 */
export declare function buildModelsListResponse(models: AnthropicModel[]): {
    data: AnthropicModel[];
    has_more: boolean;
    first_id: string | null;
    last_id: string | null;
};
//# sourceMappingURL=llm-backend-adapter.d.ts.map