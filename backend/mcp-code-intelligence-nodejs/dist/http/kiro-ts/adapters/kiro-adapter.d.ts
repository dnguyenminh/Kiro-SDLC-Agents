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
import * as http from 'http';
import { AnthropicRequest, AuthResult, ContentBlock } from '../types.js';
import { SseEvent } from '../kiro-stream.js';
import { LLMBackendAdapter, AnthropicModel } from './llm-backend-adapter.js';
/**
 * Canonical list of Kiro-supported models. Each maps (via kiro-converter
 * `mapModel`) to a Kiro model family. These ids MUST contain the family
 * keyword (sonnet/opus/haiku) and version so mapModel resolves correctly.
 *
 * This is the SINGLE SOURCE OF TRUTH for the Kiro model list — the Settings
 * panel AVAILABLE_MODELS.kiro must mirror these ids.
 */
export declare const KIRO_MODELS: AnthropicModel[];
/** Options passed by chat-handler so the adapter can write history back. */
export interface KiroAdapterOptions {
    /** Full message history (session.getMessages()) used for conversion. */
    messages?: AnthropicRequest['messages'];
    /** Invoked with the assistant content blocks once the response completes. */
    onComplete?: (blocks: ContentBlock[]) => void;
}
export declare class KiroAdapter implements LLMBackendAdapter {
    readonly name = "kiro";
    private readonly auth;
    private readonly options;
    constructor(auth: AuthResult, options?: KiroAdapterOptions);
    listModels(): Promise<AnthropicModel[]>;
    createMessage(request: AnthropicRequest, res: http.ServerResponse, stream: boolean): Promise<void>;
    /**
     * Send the conversationState request to generateAssistantResponse, parse the
     * AWS Event Stream binary frames, convert them to Anthropic SSE, and either
     * stream them to the client or aggregate them into a single JSON response.
     */
    private proxyKiroStream;
}
/**
 * Build the KiroIDE User-Agent headers used by generateAssistantResponse.
 * Mirrors kiro.rs `src/kiro/endpoint/ide.rs`.
 */
export declare function buildKiroHeaders(host: string, bearerToken: string, machineId: string): Record<string, string>;
/** Reconstruct content blocks from a list of Anthropic SSE events. */
export declare function collectBlocksFromSse(events: SseEvent[]): ContentBlock[];
/** Build a single Anthropic message JSON from collected SSE events (non-streaming). */
export declare function buildMessageFromSse(events: SseEvent[], model: string): Record<string, unknown>;
//# sourceMappingURL=kiro-adapter.d.ts.map