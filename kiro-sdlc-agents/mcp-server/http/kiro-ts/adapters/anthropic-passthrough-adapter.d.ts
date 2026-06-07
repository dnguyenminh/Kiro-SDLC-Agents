/**
 * Anthropic Passthrough Adapter — KSA-237 (Adapter Pattern)
 *
 * Implements LLMBackendAdapter for the bring-your-own-key path: forwards the
 * Anthropic request directly to api.anthropic.com using the client's
 * x-api-key. Used when the gateway has no Kiro SSO credentials, or when the
 * client explicitly supplies a real `sk-ant-` key.
 */
import * as http from 'http';
import { AnthropicRequest, ContentBlock } from '../types.js';
import { LLMBackendAdapter, AnthropicModel } from './llm-backend-adapter.js';
/**
 * Static fallback models served when no key is available or the upstream
 * `/v1/models` call fails. Mirrors the commonly-available Anthropic models.
 */
export declare const ANTHROPIC_FALLBACK_MODELS: AnthropicModel[];
/** Options passed by chat-handler so the adapter can build/store history. */
export interface AnthropicPassthroughOptions {
    /** Upstream body builder using full session history. */
    buildBody?: (request: AnthropicRequest) => Record<string, unknown>;
    /** Invoked with the assistant content blocks once the response completes. */
    onComplete?: (blocks: ContentBlock[]) => void;
}
export declare class AnthropicPassthroughAdapter implements LLMBackendAdapter {
    readonly name = "anthropic-passthrough";
    private readonly apiKey;
    private readonly options;
    constructor(apiKey: string | undefined, options?: AnthropicPassthroughOptions);
    listModels(): Promise<AnthropicModel[]>;
    createMessage(request: AnthropicRequest, res: http.ServerResponse, stream: boolean): Promise<void>;
}
/**
 * GET https://api.anthropic.com/v1/models using the supplied key. Maps the
 * response to AnthropicModel[]. Throws on non-2xx or network failure.
 */
export declare function fetchAnthropicModels(apiKey: string): Promise<AnthropicModel[]>;
//# sourceMappingURL=anthropic-passthrough-adapter.d.ts.map