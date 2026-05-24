"use strict";
/**
 * KbCacheWriter — ingest/update cache entries in KB on successful execution.
 * KSA-139: Async fire-and-forget writes, dedup by title.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.KbCacheWriter = void 0;
const kb_models_js_1 = require("./kb-models.js");
class KbCacheWriter {
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
    /** Handle successful tool execution — ingest/update cache entries. */
    async onSuccess(toolName, serverName, description, inputSchema, agentName, source) {
        if (!this.config.enabled || !this.memoryEngine)
            return;
        try {
            if (source === kb_models_js_1.CacheSource.DISCOVERED) {
                // New tool: ingest into both L1 and L2
                await this.ingestEntry('global', toolName, serverName, description, inputSchema);
                await this.ingestEntry(`agent:${agentName}`, toolName, serverName, description, inputSchema);
                console.error(`[kb-cache-writer] Ingested ${toolName} → L1 + L2(${agentName})`);
            }
            else if (source === kb_models_js_1.CacheSource.L1_CACHE) {
                // From L1: promote to L2 (agent scope)
                await this.ingestEntry(`agent:${agentName}`, toolName, serverName, description, inputSchema);
                await this.incrementHits('global', toolName);
                console.error(`[kb-cache-writer] Promoted ${toolName} → L2(${agentName}), L1 hits++`);
            }
            else if (source === kb_models_js_1.CacheSource.L2_CACHE) {
                // From L2: just increment hits
                await this.incrementHits(`agent:${agentName}`, toolName);
                console.error(`[kb-cache-writer] Hit++ ${toolName} in L2(${agentName})`);
            }
        }
        catch (e) {
            console.error(`[kb-cache-writer] Write error: ${e.message}`);
        }
    }
    /** Ingest a new cache entry into KB. */
    async ingestEntry(scope, toolName, serverName, description, inputSchema) {
        const entry = (0, kb_models_js_1.createToolCacheEntry)(toolName, serverName, description, inputSchema, scope);
        const title = (0, kb_models_js_1.cacheTitle)(scope, toolName);
        const tags = (0, kb_models_js_1.cacheTags)(scope, serverName);
        const content = (0, kb_models_js_1.entryToKbContent)(entry);
        const knowledge = this.memoryEngine?.knowledge;
        if (!knowledge)
            return;
        knowledge.insert({
            content,
            summary: title,
            type: 'CONTEXT',
            tier: 'WORKING',
            source: 'tool-cache',
            tags,
        });
    }
    /** Increment hit count for an existing entry (best-effort). */
    async incrementHits(scope, toolName) {
        const title = (0, kb_models_js_1.cacheTitle)(scope, toolName);
        const search = this.memoryEngine?.search;
        if (!search)
            return;
        try {
            const results = search.search(title, { limit: 1 });
            if (!results || results.length === 0)
                return;
            const result = results[0];
            const content = typeof result === 'string' ? result : result?.content;
            if (!content)
                return;
            const data = JSON.parse(content);
            data.hits = (data.hits ?? 0) + 1;
            data.last_used = new Date().toISOString();
            const knowledge = this.memoryEngine?.knowledge;
            if (!knowledge)
                return;
            // Re-ingest with updated content (dedup by title/summary)
            knowledge.insert({
                content: JSON.stringify(data, null, 2),
                summary: title,
                type: 'CONTEXT',
                tier: 'WORKING',
                source: 'tool-cache',
                tags: (0, kb_models_js_1.cacheTags)(scope, data.server_name ?? ''),
            });
        }
        catch (e) {
            // Best-effort — don't fail on hit increment
            console.error(`[kb-cache-writer] incrementHits error: ${e.message}`);
        }
    }
}
exports.KbCacheWriter = KbCacheWriter;
//# sourceMappingURL=kb-writer.js.map