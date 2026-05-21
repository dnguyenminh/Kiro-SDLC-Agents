/**
 * CacheEntry — interface and helpers for adaptive token cache entries.
 */

export interface CacheEntry {
  tokens: Set<string>;
  toolName: string;
  score: number;
  registryHash: string;
  timestamp: string;
  hitCount: number;
  lastHit: string;
}

/** Create a new CacheEntry. */
export function createCacheEntry(
  tokens: Set<string>, toolName: string, score: number, registryHash: string
): CacheEntry {
  const now = nowIso();
  return { tokens, toolName, score, registryHash, timestamp: now, hitCount: 0, lastHit: now };
}

/** Record a cache hit on an entry. */
export function touchEntry(entry: CacheEntry): void {
  entry.hitCount++;
  entry.lastHit = nowIso();
}

/** Check if entry is stale (registry changed). */
export function isStale(entry: CacheEntry, currentHash: string): boolean {
  return entry.registryHash !== currentHash;
}

/** Serialize entry to JSON-compatible object. */
export function entryToJson(entry: CacheEntry): Record<string, any> {
  return {
    tokens: [...entry.tokens].sort(),
    tool_name: entry.toolName,
    score: entry.score,
    timestamp: entry.timestamp,
    hit_count: entry.hitCount,
    last_hit: entry.lastHit,
    tool_version: entry.registryHash,
  };
}

/** Deserialize entry from JSON object. */
export function entryFromJson(data: Record<string, any>): CacheEntry {
  return {
    tokens: new Set(data.tokens ?? []),
    toolName: data.tool_name ?? '',
    score: data.score ?? 0,
    registryHash: data.tool_version ?? '',
    timestamp: data.timestamp ?? nowIso(),
    hitCount: data.hit_count ?? 0,
    lastHit: data.last_hit ?? nowIso(),
  };
}

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}
