"use strict";
/**
 * CompressionCache — Two-Tier LRU Cache
 * KSA-244: Skip Set (10K entries) + Result Cache (500 entries)
 *
 * Uses Map insertion order for O(1) LRU eviction.
 * Hash: SHA-256 truncated to 16 bytes (32 hex chars).
 * Budget: < 0.05ms per lookup.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompressionCache = void 0;
const crypto = __importStar(require("crypto"));
class CompressionCache {
    maxSkipSet;
    maxResultCache;
    skipSet;
    resultCache;
    hits = 0;
    misses = 0;
    constructor(maxSkipSet = 10_000, maxResultCache = 500) {
        this.maxSkipSet = maxSkipSet;
        this.maxResultCache = maxResultCache;
        this.skipSet = new Map();
        this.resultCache = new Map();
    }
    lookup(content) {
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
    store(content, result) {
        const hash = this.hash(content);
        if (result.skipped) {
            this.addToSkipSet(hash);
        }
        else {
            this.addToResultCache(hash, result);
        }
    }
    getStats() {
        const total = this.hits + this.misses;
        return {
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? this.hits / total : 0,
            skipSetSize: this.skipSet.size,
            resultCacheSize: this.resultCache.size,
        };
    }
    hash(content) {
        return crypto.createHash('sha256').update(content).digest('hex').substring(0, 32);
    }
    addToSkipSet(hash) {
        if (this.skipSet.size >= this.maxSkipSet) {
            const firstKey = this.skipSet.keys().next().value;
            if (firstKey)
                this.skipSet.delete(firstKey);
        }
        this.skipSet.set(hash, true);
    }
    addToResultCache(hash, result) {
        if (this.resultCache.size >= this.maxResultCache) {
            const firstKey = this.resultCache.keys().next().value;
            if (firstKey)
                this.resultCache.delete(firstKey);
        }
        this.resultCache.set(hash, result);
    }
}
exports.CompressionCache = CompressionCache;
//# sourceMappingURL=compression-cache.js.map