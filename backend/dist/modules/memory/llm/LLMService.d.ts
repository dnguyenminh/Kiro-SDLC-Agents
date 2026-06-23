/**
 * LLMService — facade for multi-provider LLM access.
 * Reads config from backend config, selects appropriate adapter.
 */
import type { LLMConfig, LLMMessage, LLMResponse } from './types.js';
export declare class LLMService {
    private config;
    private adapter;
    constructor(config?: Partial<LLMConfig>);
    complete(messages: LLMMessage[]): Promise<LLMResponse>;
    isAvailable(): Promise<boolean>;
    getConfig(): LLMConfig;
    /** Convenience: ask a simple question */
    ask(prompt: string, systemPrompt?: string): Promise<string>;
    /** Name a cluster of entries given their summaries */
    nameCluster(summaries: string[]): Promise<string>;
}
