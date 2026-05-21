/**
 * Cache module — adaptive token cache for find_tools acceleration.
 */

export { AdaptiveTokenCache } from './adaptive-cache.js';
export { CacheEntry, createCacheEntry, touchEntry, entryToJson, entryFromJson } from './cache-entry.js';
export { computeTokenOverlap, evictLru, invalidateStale } from './invalidation.js';
export { DebouncedPersistence } from './persistence.js';
