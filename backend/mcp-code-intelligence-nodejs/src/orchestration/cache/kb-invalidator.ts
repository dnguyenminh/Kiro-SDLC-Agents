/**
 * KbCacheInvalidator — remove stale cache entries on permanent failure.
 * KSA-139: Classifies errors and invalidates only on permanent failures.
 */

import { cacheTitle } from './kb-models.js';
import { classifyError, ErrorClass } from './error-classifier.js';

export class KbCacheInvalidator {
  private memoryEngine: any;

  constructor(memoryEngine: any) {
    this.memoryEngine = memoryEngine;
  }

  /** Handle failed tool execution — invalidate if permanent error. */
  async onFailure(toolName: string, agentName: string, errorMessage: string): Promise<void> {
    const errorClass = classifyError(errorMessage);

    if (errorClass === ErrorClass.TRANSIENT) {
      console.error(`[kb-cache-invalidator] Transient error for ${toolName}, keeping cache`);
      return;
    }

    if (errorClass === ErrorClass.SERVER_DISCONNECT) {
      // Bulk invalidation handled separately
      console.error(`[kb-cache-invalidator] Server disconnect for ${toolName}`);
      return;
    }

    // Permanent error — invalidate both L2 and L1
    await this.deleteEntry(`agent:${agentName}`, toolName);
    await this.deleteEntry('global', toolName);
    console.error(`[kb-cache-invalidator] Invalidated ${toolName} (${errorClass})`);
  }

  /** Bulk invalidate all entries for a disconnected server. */
  async invalidateServer(serverName: string): Promise<number> {
    const search = this.memoryEngine?.search;
    if (!search) return 0;

    try {
      const results = search.search(`tool-cache server:${serverName}`, {
        limit: 200,
        tags: `tool-cache, server:${serverName}`,
      });
      if (!results || results.length === 0) return 0;

      let count = 0;
      for (const result of results) {
        const id = result?.id;
        if (id) {
          this.deleteById(id);
          count++;
        }
      }
      console.error(`[kb-cache-invalidator] Bulk invalidated ${count} entries for server ${serverName}`);
      return count;
    } catch (e: any) {
      console.error(`[kb-cache-invalidator] Bulk invalidation error: ${e.message}`);
      return 0;
    }
  }

  /** Delete a specific cache entry by scope + toolName. */
  private async deleteEntry(scope: string, toolName: string): Promise<void> {
    const title = cacheTitle(scope, toolName);
    const search = this.memoryEngine?.search;
    if (!search) return;

    try {
      const results = search.search(title, { limit: 1 });
      if (!results || results.length === 0) return;
      const id = results[0]?.id;
      if (id) this.deleteById(id);
    } catch (e: any) {
      console.error(`[kb-cache-invalidator] Delete error (${title}): ${e.message}`);
    }
  }

  /** Delete KB entry by ID (best-effort). */
  private deleteById(id: number): void {
    try {
      const knowledge = this.memoryEngine?.knowledge;
      if (knowledge?.delete) knowledge.delete(id);
    } catch {
      // Best-effort deletion
    }
  }
}
