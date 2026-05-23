/**
 * KbCacheLookup — search KB for cached tools using L2 → L1 cascade.
 * KSA-139: Agent-scope first, then global scope, with timeout guard.
 */

import { ToolCacheEntry, CacheSource, entryFromKbContent } from './kb-models.js';
import { KbCacheConfig } from './kb-config.js';

export interface KbLookupResult {
  entry: ToolCacheEntry;
  source: CacheSource;
}

export class KbCacheLookup {
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

  /** Lookup cascade: L2 (agent scope) → L1 (global scope). */
  async find(query: string, agentName: string): Promise<KbLookupResult | null> {
    if (!this.config.enabled || !this.memoryEngine) return null;

    // Step 1: Search L2 (agent scope)
    const l2 = await this.searchScope(query, `agent:${agentName}`);
    if (l2) {
      console.error(`[kb-cache] L2 hit: ${l2.toolName} for ${agentName} (hits=${l2.hits})`);
      return { entry: l2, source: CacheSource.L2_CACHE };
    }

    // Step 2: Search L1 (global scope)
    const l1 = await this.searchScope(query, 'global');
    if (l1) {
      console.error(`[kb-cache] L1 hit: ${l1.toolName} for ${agentName} (hits=${l1.hits})`);
      return { entry: l1, source: CacheSource.L1_CACHE };
    }

    console.error(`[kb-cache] Miss: query="${query}" for ${agentName}`);
    return null;
  }

  /** Search KB with specific scope tags. Returns best match or null. */
  private async searchScope(query: string, scope: string): Promise<ToolCacheEntry | null> {
    try {
      const tagFilter = scope === 'global'
        ? 'tool-cache, scope:global'
        : `tool-cache, ${scope}`;

      const results = await this.searchWithTimeout(query, tagFilter);
      if (!results || results.length === 0) return null;

      // Parse first valid result
      for (const result of results) {
        const content = this.extractContent(result);
        if (!content) continue;
        const entry = entryFromKbContent(content, scope);
        if (entry) return entry;
      }
      return null;
    } catch (e: any) {
      console.error(`[kb-cache] Search error (${scope}): ${e.message}`);
      return null;
    }
  }

  /** Search KB with timeout guard. */
  private async searchWithTimeout(query: string, tags: string): Promise<any[]> {
    const timeoutMs = this.config.lookupTimeoutMs;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        console.error(`[kb-cache] Search timeout (${timeoutMs}ms), abandoning`);
        resolve([]);
      }, timeoutMs);

      try {
        const search = this.memoryEngine?.search;
        if (!search) { clearTimeout(timer); resolve([]); return; }
        const results = search.search(`tool-cache ${query}`, { limit: 5, tags });
        clearTimeout(timer);
        resolve(results ?? []);
      } catch (e: any) {
        clearTimeout(timer);
        resolve([]);
      }
    });
  }

  /** Extract content string from KB search result. */
  private extractContent(result: any): string | null {
    if (typeof result === 'string') return result;
    if (result?.content) return result.content;
    return null;
  }
}
