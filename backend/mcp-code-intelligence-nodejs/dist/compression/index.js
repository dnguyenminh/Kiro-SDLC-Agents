"use strict";
/**
 * CompressionPipeline — Public API & Orchestrator
 * KSA-244: Entry point for the Context Compression Module
 *
 * Coordinates ContentRouter, SmartCrusher, CCRStore, CompressionCache,
 * CacheAligner, CircuitBreaker, and Metrics.
 *
 * Total budget: < 10ms per message (p99).
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompressionMetrics = exports.CircuitBreaker = exports.CacheAligner = exports.CompressionCache = exports.CCRStore = exports.SmartCrusher = exports.ContentRouter = exports.CompressionPipeline = void 0;
exports.createCompressionPipeline = createCompressionPipeline;
const content_router_js_1 = require("./content-router.js");
const smart_crusher_js_1 = require("./smart-crusher.js");
const ccr_store_js_1 = require("./ccr-store.js");
const compression_cache_js_1 = require("./compression-cache.js");
const cache_aligner_js_1 = require("./cache-aligner.js");
const circuit_breaker_js_1 = require("./circuit-breaker.js");
const metrics_js_1 = require("./metrics.js");
class CompressionPipeline {
    contentRouter;
    smartCrusher;
    ccrStore;
    cache;
    cacheAligner;
    circuitBreaker;
    metrics;
    constructor(db) {
        this.contentRouter = new content_router_js_1.ContentRouter();
        this.smartCrusher = new smart_crusher_js_1.SmartCrusher();
        this.ccrStore = new ccr_store_js_1.CCRStore(db);
        this.cache = new compression_cache_js_1.CompressionCache();
        this.cacheAligner = new cache_aligner_js_1.CacheAligner();
        this.circuitBreaker = new circuit_breaker_js_1.CircuitBreaker();
        this.metrics = new metrics_js_1.CompressionMetrics();
    }
    /**
     * Compress an array of messages for a given session.
     * BR-60: Only compress role "user"/"assistant" with string content
     * BR-61: Never compress tool_use or tool_result blocks
     * BR-62: System prompt: CacheAligner only
     * BR-63: Failsafe — errors never propagate
     */
    compress(messages, sessionId) {
        return messages.map(msg => this.compressMessage(msg, sessionId));
    }
    compressMessage(msg, sessionId) {
        // BR-62: System prompt gets CacheAligner treatment only
        if (msg.role === 'system' && typeof msg.content === 'string') {
            return this.alignSystemPrompt(msg);
        }
        // BR-60: Only compress string content from user/assistant
        if (typeof msg.content !== 'string')
            return msg;
        if (msg.role !== 'user' && msg.role !== 'assistant')
            return msg;
        // BR-04: Skip short content
        if (msg.content.length < 100)
            return msg;
        // Circuit breaker check
        if (!this.circuitBreaker.allowRequest())
            return msg;
        try {
            const start = performance.now();
            const result = this.compressContent(msg.content);
            const elapsed = performance.now() - start;
            // BR-53: Timeout > 10ms = failure
            if (elapsed > 10) {
                this.circuitBreaker.recordFailure();
            }
            else {
                this.circuitBreaker.recordSuccess();
            }
            this.metrics.record(result, elapsed, false);
            return result.skipped ? msg : { ...msg, content: result.compressed };
        }
        catch {
            // Failsafe: errors never propagate
            this.circuitBreaker.recordFailure();
            return msg;
        }
    }
    compressContent(content) {
        // Step 1: Check cache
        const cached = this.cache.lookup(content);
        if (cached.hit) {
            if (cached.result)
                return cached.result;
            // Skip set hit — return skip result
            return {
                compressed: content,
                originalSize: content.length,
                compressedSize: content.length,
                ratio: 1,
                strategy: 'none',
                skipped: true,
            };
        }
        // Step 2: Detect content type
        const classification = this.contentRouter.detect(content);
        if (!classification.shouldCompress) {
            const skipResult = {
                compressed: content,
                originalSize: content.length,
                compressedSize: content.length,
                ratio: 1,
                strategy: 'none',
                skipped: true,
            };
            this.cache.store(content, skipResult);
            return skipResult;
        }
        // Step 3: Parse and compress
        const items = JSON.parse(content);
        const result = this.smartCrusher.compress(items);
        // Step 4: Store original in CCR (if compression happened)
        if (!result.skipped) {
            const key = this.ccrStore.store(content, classification.type);
            result.compressed = `[CCR_KEY:${key}]\n` + result.compressed;
            // Update sizes to account for CCR key prefix
            result.compressedSize = result.compressed.length;
            result.ratio = result.compressedSize / result.originalSize;
        }
        // Step 5: Cache result
        this.cache.store(content, result);
        return result;
    }
    alignSystemPrompt(msg) {
        const aligned = this.cacheAligner.align(msg.content);
        if (!aligned.modified)
            return msg;
        return { ...msg, content: aligned.prompt };
    }
    /** Get metrics summary for monitoring */
    getMetrics() {
        return {
            compression: this.metrics.getSummary(),
            cache: this.cache.getStats(),
            circuitBreaker: this.circuitBreaker.getState(),
        };
    }
    /** Get CCR Store for MCP tool access */
    getCCRStore() {
        return this.ccrStore;
    }
}
exports.CompressionPipeline = CompressionPipeline;
/**
 * Factory function — public API
 */
function createCompressionPipeline(db) {
    return new CompressionPipeline(db);
}
// Re-exports
var content_router_js_2 = require("./content-router.js");
Object.defineProperty(exports, "ContentRouter", { enumerable: true, get: function () { return content_router_js_2.ContentRouter; } });
var smart_crusher_js_2 = require("./smart-crusher.js");
Object.defineProperty(exports, "SmartCrusher", { enumerable: true, get: function () { return smart_crusher_js_2.SmartCrusher; } });
var ccr_store_js_2 = require("./ccr-store.js");
Object.defineProperty(exports, "CCRStore", { enumerable: true, get: function () { return ccr_store_js_2.CCRStore; } });
var compression_cache_js_2 = require("./compression-cache.js");
Object.defineProperty(exports, "CompressionCache", { enumerable: true, get: function () { return compression_cache_js_2.CompressionCache; } });
var cache_aligner_js_2 = require("./cache-aligner.js");
Object.defineProperty(exports, "CacheAligner", { enumerable: true, get: function () { return cache_aligner_js_2.CacheAligner; } });
var circuit_breaker_js_2 = require("./circuit-breaker.js");
Object.defineProperty(exports, "CircuitBreaker", { enumerable: true, get: function () { return circuit_breaker_js_2.CircuitBreaker; } });
var metrics_js_2 = require("./metrics.js");
Object.defineProperty(exports, "CompressionMetrics", { enumerable: true, get: function () { return metrics_js_2.CompressionMetrics; } });
__exportStar(require("./types.js"), exports);
//# sourceMappingURL=index.js.map