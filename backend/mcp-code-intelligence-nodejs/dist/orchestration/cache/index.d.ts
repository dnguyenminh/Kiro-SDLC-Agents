/**
 * Cache module — adaptive token cache + KB-backed 2-level agent tool cache.
 * KSA-102: Adaptive token cache (in-memory + file persistence).
 * KSA-139: KB-backed 2-level cache (L1 global + L2 per-agent).
 */
export { AdaptiveTokenCache } from './adaptive-cache.js';
export { CacheEntry, createCacheEntry, touchEntry, entryToJson, entryFromJson } from './cache-entry.js';
export { computeTokenOverlap, evictLru, invalidateStale } from './invalidation.js';
export { DebouncedPersistence } from './persistence.js';
export { ToolCacheEntry, CacheSource, cacheTitle, cacheTags, entryToKbContent, entryFromKbContent, createToolCacheEntry } from './kb-models.js';
export { KbCacheLookup, KbLookupResult } from './kb-lookup.js';
export { KbCacheWriter } from './kb-writer.js';
export { KbCacheInvalidator } from './kb-invalidator.js';
export { KbInjectionEngine, InjectionPayload } from './kb-injector.js';
export { KbCacheConfig, readKbCacheConfig, defaultKbCacheConfig } from './kb-config.js';
export { ErrorClass, classifyError } from './error-classifier.js';
//# sourceMappingURL=index.d.ts.map