/**
 * AdaptiveTokenCache — self-learning fuzzy token cache for find_tools.
 */

import { CacheEntry, createCacheEntry, touchEntry, entryToJson, entryFromJson } from './cache-entry.js';
import { computeTokenOverlap, evictLru, invalidateStale } from './invalidation.js';
import { DebouncedPersistence } from './persistence.js';

const DEFAULT_THRESHOLD = 0.80;
const DEFAULT_CONFIDENCE = 0.75;

export class AdaptiveTokenCache {
  private persistence: DebouncedPersistence;
  private entries: CacheEntry[] = [];
  private loaded = false;
  private hits = 0;
  private misses = 0;

  constructor(cachePath: string, debounceS: number = 5.0) {
    this.persistence = new DebouncedPersistence(cachePath, debounceS);
  }

  /** Find best cache entry with ≥threshold token overlap. */
  findFuzzy(tokens: Set<string>, threshold: number = DEFAULT_THRESHOLD): CacheEntry | null {
    this.ensureLoaded();
    let best: CacheEntry | null = null;
    let bestOverlap = 0;
    for (const entry of this.entries) {
      const overlap = computeTokenOverlap(tokens, entry.tokens);
      if (overlap >= threshold && overlap > bestOverlap) {
        best = entry;
        bestOverlap = overlap;
      }
    }
    if (best) { this.hits++; touchEntry(best); }
    else { this.misses++; }
    return best;
  }

  /** Add or update cache entry from embedding result. */
  add(tokens: Set<string>, toolName: string, score: number, registryHash: string): void {
    this.ensureLoaded();
    if (score < DEFAULT_CONFIDENCE) return;
    const existing = this.findExact(toolName, tokens);
    if (existing) {
      this.mergeEntry(existing, tokens, score);
    } else {
      this.entries.push(createCacheEntry(tokens, toolName, score, registryHash));
    }
    this.entries = evictLru(this.entries);
  }

  /** Remove entries with mismatched registry hash. */
  invalidateStale(currentHash: string): number {
    this.ensureLoaded();
    const [kept, removed] = invalidateStale(this.entries, currentHash);
    this.entries = kept;
    if (removed > 0) this.schedulePersist();
    return removed;
  }

  /** Schedule debounced write to disk. */
  schedulePersist(): void {
    this.persistence.scheduleWrite(this.serialize());
  }

  /** Force load from disk. */
  load(): void { this.doLoad(); }

  get size(): number { this.ensureLoaded(); return this.entries.length; }
  get hitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }

  private ensureLoaded(): void { if (!this.loaded) this.doLoad(); }

  private doLoad(): void {
    this.loaded = true;
    const data = this.persistence.load();
    if (!data) return;
    const raw = data.entries ?? [];
    this.entries = raw.map((e: any) => entryFromJson(e));
    console.error(`[adaptive-cache] Loaded ${this.entries.length} cache entries`);
  }

  private findExact(toolName: string, tokens: Set<string>): CacheEntry | null {
    for (const entry of this.entries) {
      if (entry.toolName === toolName && computeTokenOverlap(tokens, entry.tokens) >= 0.6) {
        return entry;
      }
    }
    return null;
  }

  private mergeEntry(entry: CacheEntry, newTokens: Set<string>, score: number): void {
    for (const t of newTokens) entry.tokens.add(t);
    entry.score = Math.max(entry.score, score);
    touchEntry(entry);
  }

  private serialize(): Record<string, any> {
    return { version: 1, entries: this.entries.map(entryToJson) };
  }
}
