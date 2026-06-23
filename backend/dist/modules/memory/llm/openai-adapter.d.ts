/**
 * OpenAI-compatible adapter — works for OpenAI, Azure, vLLM, LM Studio, etc.
 */
import type { LLMAdapter, LLMConfig, LLMMessage, LLMResponse } from './types.js';
export declare class OpenAIAdapter implements LLMAdapter {
    complete(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse>;
    isAvailable(config: LLMConfig): Promise<boolean>;
}
