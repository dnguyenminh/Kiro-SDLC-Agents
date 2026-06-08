/**
 * CompressionCache — Two-Tier LRU Cache
 * KSA-244: Skip Set (10K entries) + Result Cache (500 entries)
 * 
 * Uses Map insertion order for O(1) LRU eviction.
 * Hash: SHA-256 truncated to 16 bytes (32 hex chars).
 * Budget: < 0.05ms per lookup.
 */

import * as crypto from 'crypto';
import { CacheResult, CompressionResult } from './types.js';

export class CompressionCache {
  private skipSet: Map<string, boolean>;
  private resultCache: Map<string, CompressionResult>;
  private hits = 0;
  private misses = 0;

  constructor(
    private maxSkipSet: number = 10_000,
    private maxResultCache: number = 500,
  ) {
    this.skipSet = new Map();
    this.resultCache = new Map();
  }

  lookup(content: string): CacheResult {
    const hash = this.hash(content);

    if (this.skipSet.has(hash)) {
      this.hits++;
      this.skipSet.delete(hash);
      this.skipSet.set(hash, true);
      return { hit: true, source: 'skip_set' };
    }

    const cached = this.resultCache.get(hash);
    if (cached) {
      this.hits++;
      this.resultCache.delete(hash);
      this.resultCache.set(hash, cached);
      return { hit: true, source: 'result_cache', result: cached };
    }

    this.misses++;
    return { hit: false, source: 'miss' };
  }

  store(content: string, result: CompressionResult): void {
    const hash = this.hash(content);
    if (result.skipped) {
      this.addToSkipSet(hash);
    } else {
      this.addToResultCache(hash, result);
    }
  }

  getStats(): { hits: number; misses: number; hitRate: number; skipSetSize: number; resultCacheSize: number } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      skipSetSize: this.skipSet.size,
      resultCacheSize: this.resultCache.size,
    };
  }

  private hash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 32);
  }

  private addToSkipSet(hash: string): void {
    if (this.skipSet.size >= this.maxSkipSet) {
      const firstKey = this.skipSet.keys().next().value;
      if (firstKey) this.skipSet.delete(firstKey);
    }
    this.skipSet.set(hash, true);
  }

  private addToResultCache(hash: string, result: CompressionResult): void {
    if (this.resultCache.size >= this.maxResultCache) {
      const firstKey = this.resultCache.keys().next().value;
      if (firstKey) this.resultCache.delete(firstKey);
    }
    this.resultCache.set(hash, result);
  }
}
