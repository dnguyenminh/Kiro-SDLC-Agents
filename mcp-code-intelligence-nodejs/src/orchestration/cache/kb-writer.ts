/**
 * KbCacheWriter — ingest/update cache entries in KB on successful execution.
 * KSA-139: Async fire-and-forget writes, dedup by title.
 */

import {
  ToolCacheEntry, CacheSource, cacheTitle, cacheTags,
  entryToKbContent, createToolCacheEntry,
} from './kb-models.js';
import { KbCacheConfig } from './kb-config.js';

export class KbCacheWriter {
  private memoryEngine: any;
  private config: KbCacheConfig;

  constructor(memoryEngine: any, config: KbCacheConfig) {
    this.memoryEngine = memoryEngine;
    this.config = config;
  }

  /** Update config (hot-reload support). */
  updateConfig(config: KbCacheConfig): void {
    this.config = config;
  }

  /** Handle successful tool execution — ingest/update cache entries. */
  async onSuccess(
    toolName: string, serverName: string, description: string,
    inputSchema: Record<string, any>, agentName: string, source: CacheSource
  ): Promise<void> {
    if (!this.config.enabled || !this.memoryEngine) return;

    try {
      if (source === CacheSource.DISCOVERED) {
        // New tool: ingest into both L1 and L2
        await this.ingestEntry('global', toolName, serverName, description, inputSchema);
        await this.ingestEntry(`agent:${agentName}`, toolName, serverName, description, inputSchema);
        console.error(`[kb-cache-writer] Ingested ${toolName} → L1 + L2(${agentName})`);
      } else if (source === CacheSource.L1_CACHE) {
        // From L1: promote to L2 (agent scope)
        await this.ingestEntry(`agent:${agentName}`, toolName, serverName, description, inputSchema);
        await this.incrementHits('global', toolName);
        console.error(`[kb-cache-writer] Promoted ${toolName} → L2(${agentName}), L1 hits++`);
      } else if (source === CacheSource.L2_CACHE) {
        // From L2: just increment hits
        await this.incrementHits(`agent:${agentName}`, toolName);
        console.error(`[kb-cache-writer] Hit++ ${toolName} in L2(${agentName})`);
      }
    } catch (e: any) {
      console.error(`[kb-cache-writer] Write error: ${e.message}`);
    }
  }

  /** Ingest a new cache entry into KB. */
  private async ingestEntry(
    scope: string, toolName: string, serverName: string,
    description: string, inputSchema: Record<string, any>
  ): Promise<void> {
    const entry = createToolCacheEntry(toolName, serverName, description, inputSchema, scope);
    const title = cacheTitle(scope, toolName);
    const tags = cacheTags(scope, serverName);
    const content = entryToKbContent(entry);

    const knowledge = this.memoryEngine?.knowledge;
    if (!knowledge) return;

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
  private async incrementHits(scope: string, toolName: string): Promise<void> {
    const title = cacheTitle(scope, toolName);
    const search = this.memoryEngine?.search;
    if (!search) return;

    try {
      const results = search.search(title, { limit: 1 });
      if (!results || results.length === 0) return;

      const result = results[0];
      const content = typeof result === 'string' ? result : result?.content;
      if (!content) return;

      const data = JSON.parse(content);
      data.hits = (data.hits ?? 0) + 1;
      data.last_used = new Date().toISOString();

      const knowledge = this.memoryEngine?.knowledge;
      if (!knowledge) return;

      // Re-ingest with updated content (dedup by title/summary)
      knowledge.insert({
        content: JSON.stringify(data, null, 2),
        summary: title,
        type: 'CONTEXT',
        tier: 'WORKING',
        source: 'tool-cache',
        tags: cacheTags(scope, data.server_name ?? ''),
      });
    } catch (e: any) {
      // Best-effort — don't fail on hit increment
      console.error(`[kb-cache-writer] incrementHits error: ${e.message}`);
    }
  }
}
