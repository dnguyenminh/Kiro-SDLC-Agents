/**
 * CompressionPipeline — Public API & Orchestrator
 * KSA-244: Entry point for the Context Compression Module
 * 
 * Coordinates ContentRouter, SmartCrusher, CCRStore, CompressionCache,
 * CacheAligner, CircuitBreaker, and Metrics.
 * 
 * Total budget: < 10ms per message (p99).
 */

import Database from 'better-sqlite3';
import { ContentRouter } from './content-router.js';
import { SmartCrusher } from './smart-crusher.js';
import { CCRStore } from './ccr-store.js';
import { CompressionCache } from './compression-cache.js';
import { CacheAligner } from './cache-aligner.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { CompressionMetrics } from './metrics.js';
import { CompressionResult, Message } from './types.js';

export class CompressionPipeline {
  private contentRouter: ContentRouter;
  private smartCrusher: SmartCrusher;
  private ccrStore: CCRStore;
  private cache: CompressionCache;
  private cacheAligner: CacheAligner;
  private circuitBreaker: CircuitBreaker;
  private metrics: CompressionMetrics;

  constructor(db: Database.Database) {
    this.contentRouter = new ContentRouter();
    this.smartCrusher = new SmartCrusher();
    this.ccrStore = new CCRStore(db);
    this.cache = new CompressionCache();
    this.cacheAligner = new CacheAligner();
    this.circuitBreaker = new CircuitBreaker();
    this.metrics = new CompressionMetrics();
  }

  /**
   * Compress an array of messages for a given session.
   * BR-60: Only compress role "user"/"assistant" with string content
   * BR-61: Never compress tool_use or tool_result blocks
   * BR-62: System prompt: CacheAligner only
   * BR-63: Failsafe — errors never propagate
   */
  compress(messages: Message[], sessionId: string): Message[] {
    return messages.map(msg => this.compressMessage(msg, sessionId));
  }

  private compressMessage(msg: Message, sessionId: string): Message {
    // BR-62: System prompt gets CacheAligner treatment only
    if (msg.role === 'system' && typeof msg.content === 'string') {
      return this.alignSystemPrompt(msg);
    }

    // BR-60: Only compress string content from user/assistant
    if (typeof msg.content !== 'string') return msg;
    if (msg.role !== 'user' && msg.role !== 'assistant') return msg;

    // BR-04: Skip short content
    if (msg.content.length < 100) return msg;

    // Circuit breaker check
    if (!this.circuitBreaker.allowRequest()) return msg;

    try {
      const start = performance.now();
      const result = this.compressContent(msg.content);
      const elapsed = performance.now() - start;

      // BR-53: Timeout > 10ms = failure
      if (elapsed > 10) {
        this.circuitBreaker.recordFailure();
      } else {
        this.circuitBreaker.recordSuccess();
      }

      this.metrics.record(result, elapsed, false);

      return result.skipped ? msg : { ...msg, content: result.compressed };
    } catch {
      // Failsafe: errors never propagate
      this.circuitBreaker.recordFailure();
      return msg;
    }
  }

  private compressContent(content: string): CompressionResult {
    // Step 1: Check cache
    const cached = this.cache.lookup(content);
    if (cached.hit) {
      if (cached.result) return cached.result;
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
      const skipResult: CompressionResult = {
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

  private alignSystemPrompt(msg: Message): Message {
    const aligned = this.cacheAligner.align(msg.content);
    if (!aligned.modified) return msg;
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
  getCCRStore(): CCRStore {
    return this.ccrStore;
  }
}

/**
 * Factory function — public API
 */
export function createCompressionPipeline(db: Database.Database): CompressionPipeline {
  return new CompressionPipeline(db);
}

// Re-exports
export { ContentRouter } from './content-router.js';
export { SmartCrusher } from './smart-crusher.js';
export { CCRStore } from './ccr-store.js';
export { CompressionCache } from './compression-cache.js';
export { CacheAligner } from './cache-aligner.js';
export { CircuitBreaker } from './circuit-breaker.js';
export { CompressionMetrics } from './metrics.js';
export * from './types.js';
