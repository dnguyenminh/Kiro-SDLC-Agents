"use strict";
/**
 * AdaptiveTokenCache — self-learning fuzzy token cache for find_tools.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdaptiveTokenCache = void 0;
const cache_entry_js_1 = require("./cache-entry.js");
const invalidation_js_1 = require("./invalidation.js");
const persistence_js_1 = require("./persistence.js");
const DEFAULT_THRESHOLD = 0.80;
const DEFAULT_CONFIDENCE = 0.75;
class AdaptiveTokenCache {
    persistence;
    entries = [];
    loaded = false;
    hits = 0;
    misses = 0;
    constructor(cachePath, debounceS = 5.0) {
        this.persistence = new persistence_js_1.DebouncedPersistence(cachePath, debounceS);
    }
    /** Find best cache entry with ≥threshold token overlap. */
    findFuzzy(tokens, threshold = DEFAULT_THRESHOLD) {
        this.ensureLoaded();
        let best = null;
        let bestOverlap = 0;
        for (const entry of this.entries) {
            const overlap = (0, invalidation_js_1.computeTokenOverlap)(tokens, entry.tokens);
            if (overlap >= threshold && overlap > bestOverlap) {
                best = entry;
                bestOverlap = overlap;
            }
        }
        if (best) {
            this.hits++;
            (0, cache_entry_js_1.touchEntry)(best);
        }
        else {
            this.misses++;
        }
        return best;
    }
    /** Add or update cache entry from embedding result. */
    add(tokens, toolName, score, registryHash) {
        this.ensureLoaded();
        if (score < DEFAULT_CONFIDENCE)
            return;
        const existing = this.findExact(toolName, tokens);
        if (existing) {
            this.mergeEntry(existing, tokens, score);
        }
        else {
            this.entries.push((0, cache_entry_js_1.createCacheEntry)(tokens, toolName, score, registryHash));
        }
        this.entries = (0, invalidation_js_1.evictLru)(this.entries);
    }
    /** Remove entries with mismatched registry hash. */
    invalidateStale(currentHash) {
        this.ensureLoaded();
        const [kept, removed] = (0, invalidation_js_1.invalidateStale)(this.entries, currentHash);
        this.entries = kept;
        if (removed > 0)
            this.schedulePersist();
        return removed;
    }
    /** Schedule debounced write to disk. */
    schedulePersist() {
        this.persistence.scheduleWrite(this.serialize());
    }
    /** Force load from disk. */
    load() { this.doLoad(); }
    get size() { this.ensureLoaded(); return this.entries.length; }
    get hitRate() {
        const total = this.hits + this.misses;
        return total > 0 ? this.hits / total : 0;
    }
    ensureLoaded() { if (!this.loaded)
        this.doLoad(); }
    doLoad() {
        this.loaded = true;
        const data = this.persistence.load();
        if (!data)
            return;
        const raw = data.entries ?? [];
        this.entries = raw.map((e) => (0, cache_entry_js_1.entryFromJson)(e));
        console.error(`[adaptive-cache] Loaded ${this.entries.length} cache entries`);
    }
    findExact(toolName, tokens) {
        for (const entry of this.entries) {
            if (entry.toolName === toolName && (0, invalidation_js_1.computeTokenOverlap)(tokens, entry.tokens) >= 0.6) {
                return entry;
            }
        }
        return null;
    }
    mergeEntry(entry, newTokens, score) {
        for (const t of newTokens)
            entry.tokens.add(t);
        entry.score = Math.max(entry.score, score);
        (0, cache_entry_js_1.touchEntry)(entry);
    }
    serialize() {
        return { version: 1, entries: this.entries.map(cache_entry_js_1.entryToJson) };
    }
}
exports.AdaptiveTokenCache = AdaptiveTokenCache;
//# sourceMappingURL=adaptive-cache.js.map