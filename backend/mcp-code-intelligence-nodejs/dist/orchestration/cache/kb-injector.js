"use strict";
/**
 * KbInjectionEngine — query top-N cached tools for sub-agent prompt injection.
 * KSA-139: Reduces find_tools calls by pre-loading known tools into agent prompts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.KbInjectionEngine = void 0;
const kb_models_js_1 = require("./kb-models.js");
class KbInjectionEngine {
    memoryEngine;
    config;
    constructor(memoryEngine, config) {
        this.memoryEngine = memoryEngine;
        this.config = config;
    }
    /** Update config (hot-reload support). */
    updateConfig(config) {
        this.config = config;
    }
    /** Get injection payload for a sub-agent. Returns null if nothing to inject. */
    async getInjection(agentName, count) {
        const n = count ?? this.config.injectCount;
        if (n <= 0 || !this.config.enabled || !this.memoryEngine)
            return null;
        try {
            // Step 1: Query L2 (agent-specific) tools
            const l2Tools = await this.queryScope(`agent:${agentName}`, n);
            // Step 2: If L2 has fewer than N, supplement from L1
            let tools = l2Tools;
            if (tools.length < n) {
                const remaining = n - tools.length;
                const l1Tools = await this.queryScope('global', remaining);
                // Deduplicate: L2 takes priority
                const seen = new Set(tools.map((t) => t.toolName));
                for (const t of l1Tools) {
                    if (!seen.has(t.toolName)) {
                        tools.push(t);
                        seen.add(t.toolName);
                    }
                    if (tools.length >= n)
                        break;
                }
            }
            if (tools.length === 0)
                return null;
            // Step 3: Sort by hits DESC
            tools.sort((a, b) => b.hits - a.hits);
            // Step 4: Format compact JSON
            const payload = {
                cached_tools: tools.slice(0, n).map((t) => ({
                    tool_name: t.toolName,
                    server_name: t.serverName,
                    input_schema: t.inputSchema,
                })),
            };
            console.error(`[kb-injector] Injected ${payload.cached_tools.length} tools for ${agentName}`);
            return JSON.stringify(payload);
        }
        catch (e) {
            console.error(`[kb-injector] Injection error: ${e.message}`);
            return null;
        }
    }
    /** Format injection as prompt prefix text. */
    async getInjectionPrompt(agentName, count) {
        const json = await this.getInjection(agentName, count);
        if (!json)
            return '';
        return `## Cached Tools (use execute_dynamic_tool directly)\n${json}\n\n`;
    }
    /** Query KB for cached tools in a specific scope. */
    async queryScope(scope, limit) {
        const search = this.memoryEngine?.search;
        if (!search)
            return [];
        try {
            const tagFilter = scope === 'global'
                ? 'tool-cache, scope:global'
                : `tool-cache, ${scope}`;
            const results = search.search('tool-cache', { limit, tags: tagFilter });
            if (!results || results.length === 0)
                return [];
            const entries = [];
            for (const result of results) {
                const content = typeof result === 'string' ? result : result?.content;
                if (!content)
                    continue;
                const entry = (0, kb_models_js_1.entryFromKbContent)(content, scope);
                if (entry)
                    entries.push(entry);
            }
            return entries;
        }
        catch {
            return [];
        }
    }
}
exports.KbInjectionEngine = KbInjectionEngine;
//# sourceMappingURL=kb-injector.js.map