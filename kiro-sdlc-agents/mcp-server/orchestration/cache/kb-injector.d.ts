/**
 * KbInjectionEngine — query top-N cached tools for sub-agent prompt injection.
 * KSA-139: Reduces find_tools calls by pre-loading known tools into agent prompts.
 */
import { KbCacheConfig } from './kb-config.js';
export interface InjectionPayload {
    cached_tools: Array<{
        tool_name: string;
        server_name: string;
        input_schema: Record<string, any>;
    }>;
}
export declare class KbInjectionEngine {
    private memoryEngine;
    private config;
    constructor(memoryEngine: any, config: KbCacheConfig);
    /** Update config (hot-reload support). */
    updateConfig(config: KbCacheConfig): void;
    /** Get injection payload for a sub-agent. Returns null if nothing to inject. */
    getInjection(agentName: string, count?: number): Promise<string | null>;
    /** Format injection as prompt prefix text. */
    getInjectionPrompt(agentName: string, count?: number): Promise<string>;
    /** Query KB for cached tools in a specific scope. */
    private queryScope;
}
//# sourceMappingURL=kb-injector.d.ts.map