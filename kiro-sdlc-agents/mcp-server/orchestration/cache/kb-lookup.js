"use strict";
/**
 * KbCacheLookup — search KB for cached tools using L2 → L1 cascade.
 * KSA-139: Agent-scope first, then global scope, with timeout guard.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.KbCacheLookup = void 0;
const kb_models_js_1 = require("./kb-models.js");
class KbCacheLookup {
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
    /** Lookup cascade: L2 (agent scope) → L1 (global scope). */
    async find(query, agentName) {
        if (!this.config.enabled || !this.memoryEngine)
            return null;
        // Step 1: Search L2 (agent scope)
        const l2 = await this.searchScope(query, `agent:${agentName}`);
        if (l2) {
            console.error(`[kb-cache] L2 hit: ${l2.toolName} for ${agentName} (hits=${l2.hits})`);
            return { entry: l2, source: kb_models_js_1.CacheSource.L2_CACHE };
        }
        // Step 2: Search L1 (global scope)
        const l1 = await this.searchScope(query, 'global');
        if (l1) {
            console.error(`[kb-cache] L1 hit: ${l1.toolName} for ${agentName} (hits=${l1.hits})`);
            return { entry: l1, source: kb_models_js_1.CacheSource.L1_CACHE };
        }
        console.error(`[kb-cache] Miss: query="${query}" for ${agentName}`);
        return null;
    }
    /** Search KB with specific scope tags. Returns best match or null. */
    async searchScope(query, scope) {
        try {
            const tagFilter = scope === 'global'
                ? 'tool-cache, scope:global'
                : `tool-cache, ${scope}`;
            const results = await this.searchWithTimeout(query, tagFilter);
            if (!results || results.length === 0)
                return null;
            // Parse first valid result
            for (const result of results) {
                const content = this.extractContent(result);
                if (!content)
                    continue;
                const entry = (0, kb_models_js_1.entryFromKbContent)(content, scope);
                if (entry)
                    return entry;
            }
            return null;
        }
        catch (e) {
            console.error(`[kb-cache] Search error (${scope}): ${e.message}`);
            return null;
        }
    }
    /** Search KB with timeout guard. */
    async searchWithTimeout(query, tags) {
        const timeoutMs = this.config.lookupTimeoutMs;
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                console.error(`[kb-cache] Search timeout (${timeoutMs}ms), abandoning`);
                resolve([]);
            }, timeoutMs);
            try {
                const search = this.memoryEngine?.search;
                if (!search) {
                    clearTimeout(timer);
                    resolve([]);
                    return;
                }
                const results = search.search(`tool-cache ${query}`, { limit: 5, tags });
                clearTimeout(timer);
                resolve(results ?? []);
            }
            catch (e) {
                clearTimeout(timer);
                resolve([]);
            }
        });
    }
    /** Extract content string from KB search result. */
    extractContent(result) {
        if (typeof result === 'string')
            return result;
        if (result?.content)
            return result.content;
        return null;
    }
}
exports.KbCacheLookup = KbCacheLookup;
//# sourceMappingURL=kb-lookup.js.map