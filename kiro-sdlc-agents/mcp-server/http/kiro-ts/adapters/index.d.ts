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
import { AuthResult } from '../types.js';
import { LLMBackendAdapter } from './llm-backend-adapter.js';
import { KiroAdapterOptions } from './kiro-adapter.js';
import { AnthropicPassthroughOptions } from './anthropic-passthrough-adapter.js';
export type AdapterOptions = KiroAdapterOptions & AnthropicPassthroughOptions;
/**
 * Build the backend adapter for a resolved auth context.
 *
 * @param auth    resolved auth (mode + credentials)
 * @param options per-request options (message history, body builder, onComplete)
 */
export declare function selectAdapter(auth: AuthResult, options?: AdapterOptions): LLMBackendAdapter;
export { LLMBackendAdapter, AnthropicModel, buildModelsListResponse } from './llm-backend-adapter.js';
export { KiroAdapter, KIRO_MODELS } from './kiro-adapter.js';
export { AnthropicPassthroughAdapter, ANTHROPIC_FALLBACK_MODELS, fetchAnthropicModels } from './anthropic-passthrough-adapter.js';
//# sourceMappingURL=index.d.ts.map