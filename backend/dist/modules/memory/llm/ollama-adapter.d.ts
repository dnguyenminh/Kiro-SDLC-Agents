/**
 * Ollama LLM adapter — local inference via REST API.
 * Handles qwen3 "thinking" mode: appends /no_think and falls back to thinking field.
 */
import type { LLMAdapter, LLMConfig, LLMMessage, LLMResponse } from './types.js';
export declare class OllamaAdapter implements LLMAdapter {
    complete(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse>;
    isAvailable(config: LLMConfig): Promise<boolean>;
}
