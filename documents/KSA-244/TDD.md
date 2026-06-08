# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-244: Context Compression Module

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-244 |
| Title | Context Compression Module - Port Headroom Algorithms to Node.js |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-244.docx |
| Related FSD | FSD-v1-KSA-244.docx |

---

## 1. Introduction

### 1.1 Purpose

Technical design for the Context Compression Module — pure TypeScript module integrating into chat-routes.ts to compress messages before Anthropic API calls.

### 1.2 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | 5.x |
| Runtime | Node.js | 18+ |
| Database | SQLite (better-sqlite3) | existing |
| Testing | Vitest | existing |
| Hashing | Node.js crypto (built-in) | n/a |

### 1.3 Design Principles

- Single Responsibility per component
- Fail-Safe: errors never propagate to user
- Zero new npm dependencies
- Sub-10ms performance budget
- Pure functions where possible

### 1.4 Constraints

- No package.json dependency additions
- 10ms per-message budget (p99)
- Use existing SQLite database instance
- Transparent integration (system works identically if disabled)

---

## 2. Architecture Overview

### 2.1 Architecture Diagram

![Architecture](diagrams/architecture.png)

### 2.2 Module Structure

```
src/compression/
  index.ts                 — Public API: CompressionPipeline
  content-router.ts        — Content type detection
  smart-crusher.ts         — JSON array compression
  ccr-store.ts             — SQLite persistence for originals
  cache-aligner.ts         — Date extraction for system prompts
  compression-cache.ts     — Two-tier LRU cache
  circuit-breaker.ts       — Resilience wrapper
  types.ts                 — Shared interfaces
  metrics.ts               — Metrics collector
```

### 2.3 Component Diagram

![Components](diagrams/component.png)

### 2.4 Key Decisions

| Decision | Rationale |
|----------|-----------|
| Synchronous SmartCrusher (no async) | Avoid Promise overhead in hot path |
| SQLite for CCR Store | Persistence across restarts; bounded by DB not heap |
| SHA-256 truncated for cache keys | Native C++ crypto, faster than JS hash |
| Circuit breaker wraps entire pipeline | Single failure domain |
| Map-based LRU (insertion order) | O(1) get/set/evict |

---

## 3. Detailed Design

### 3.1 CompressionPipeline (index.ts)

```typescript
export class CompressionPipeline {
  private contentRouter: ContentRouter;
  private smartCrusher: SmartCrusher;
  private ccrStore: CCRStore;
  private cache: CompressionCache;
  private cacheAligner: CacheAligner;
  private circuitBreaker: CircuitBreaker;
  private metrics: CompressionMetrics;

  constructor(db: Database) { /* init all components */ }

  compress(messages: Message[], sessionId: string): Message[] {
    return messages.map(msg => this.compressMessage(msg, sessionId));
  }

  private compressMessage(msg: Message, sessionId: string): Message {
    if (msg.role === 'system') return this.alignSystemPrompt(msg);
    if (typeof msg.content !== 'string' || msg.content.length < 100) return msg;
    if (!this.circuitBreaker.allowRequest()) return msg;

    try {
      const start = performance.now();
      const result = this.compressContent(msg.content, sessionId);
      const elapsed = performance.now() - start;
      if (elapsed > 10) this.circuitBreaker.recordFailure();
      else this.circuitBreaker.recordSuccess();
      this.metrics.record(result, elapsed);
      return result.skipped ? msg : { ...msg, content: result.compressed };
    } catch (err) {
      this.circuitBreaker.recordFailure();
      return msg; // failsafe
    }
  }

  private compressContent(content: string, sessionId: string): CompressionResult {
    // 1. Check cache
    const cached = this.cache.lookup(content);
    if (cached.hit) return cached.result ?? { compressed: content, skipped: true, ... };

    // 2. Detect type
    const classification = this.contentRouter.detect(content);
    if (!classification.shouldCompress) {
      this.cache.store(content, skipResult);
      return skipResult;
    }

    // 3. Parse and compress
    const items = JSON.parse(content);
    const result = this.smartCrusher.compress(items);

    // 4. Store original in CCR
    if (!result.skipped) {
      const key = this.ccrStore.store(content, classification.type);
      result.compressed = `[CCR_KEY:${key}]\n` + result.compressed;
    }

    // 5. Cache result
    this.cache.store(content, result);
    return result;
  }
}
```

### 3.2 ContentRouter

Pure function. Fast path: check first char before JSON.parse.

```typescript
export class ContentRouter {
  detect(content: string, hint?: ContentType): ContentClassification {
    if (hint) return { type: hint, shouldCompress: hint === 'json', compressor: hint === 'json' ? 'smartCrusher' : null };
    const trimmed = content.trimStart();
    if (trimmed[0] === '[') {
      try { if (Array.isArray(JSON.parse(trimmed))) return { type: 'json', shouldCompress: true, compressor: 'smartCrusher' }; } catch {}
    }
    if (trimmed[0] === '{') {
      try { JSON.parse(trimmed); return { type: 'json_object', shouldCompress: false, compressor: null }; } catch {}
    }
    const sample = content.substring(0, 500);
    if (/\b(import|export|function|class|const|interface)\b/.test(sample))
      return { type: 'code', shouldCompress: false, compressor: null };
    const lines = content.split('\n').slice(0, 20);
    if (lines.filter(l => /\d{4}-\d{2}-\d{2}|\d{2}:\d{2}:\d{2}/.test(l)).length > lines.length * 0.5)
      return { type: 'logs', shouldCompress: false, compressor: null };
    return { type: 'text', shouldCompress: false, compressor: null };
  }
}
```

### 3.3 SmartCrusher

Core algorithm: field entropy analysis + strategy selection + item sampling.

```typescript
export class SmartCrusher {
  compress(items: any[], options: CompressionOptions = {}): CompressionResult {
    const { targetRatio = 0.3, preserveFields = [], timeoutMs = 10 } = options;
    if (items.length < 5) return this.skip(items);

    const fields = Object.keys(items[0] ?? {});
    if (typeof items[0] !== 'object') return this.samplePrimitives(items, targetRatio);

    // Field entropy: uniqueValues / totalItems
    const entropy = new Map<string, number>();
    for (const f of fields) {
      const uniq = new Set(items.map(i => String(i[f] ?? ''))).size;
      entropy.set(f, uniq / items.length);
    }

    const lowEntropy = fields.filter(f => entropy.get(f)! < 0.2 && !preserveFields.includes(f));

    // Strategy selection
    const strategy = lowEntropy.length > fields.length * 0.5 ? 'field_reduction'
      : lowEntropy.length === 0 ? 'item_sampling' : 'hybrid';

    let result = items;
    if (strategy !== 'item_sampling') {
      result = result.map(item => {
        const r: any = {};
        for (const k of Object.keys(item)) if (!lowEntropy.includes(k)) r[k] = item[k];
        return r;
      });
    }
    if (strategy !== 'field_reduction') {
      const keep = Math.max(3, Math.ceil(result.length * targetRatio));
      const step = result.length / keep;
      result = Array.from({ length: keep }, (_, i) => result[Math.floor(i * step)]);
    }

    const header = `[COMPRESSED: ${items.length} items -> ${result.length} items (${Math.round((1-result.length/items.length)*100)}% reduction)]\n`;
    const compressed = header + JSON.stringify(result);
    const original = JSON.stringify(items);
    if (compressed.length >= original.length) return this.skip(items);

    return { compressed, originalSize: original.length, compressedSize: compressed.length,
      ratio: compressed.length / original.length, strategy, skipped: false };
  }
}
```

### 3.4 CCRStore (SQLite)

```typescript
export class CCRStore {
  constructor(private db: Database, private maxEntries = 1000, private ttlMs = 3600_000) {
    this.initTable();
  }
  store(original: string, contentType: string): string { /* INSERT + evict */ }
  retrieve(key: string): CCREntry | null { /* SELECT + update last_accessed */ }
  private evictIfNeeded(): void { /* DELETE LRU if count > max */ }
  private cleanup(): void { /* DELETE expired */ }
}
```

### 3.5 CompressionCache (Map-based LRU)

```typescript
export class CompressionCache {
  private skipSet = new Map<string, boolean>();      // max 10,000
  private resultCache = new Map<string, CompressionResult>(); // max 500

  lookup(content: string): CacheResult { /* hash -> check skipSet -> check resultCache */ }
  store(content: string, result: CompressionResult): void { /* add to appropriate tier */ }
  private hash(content: string): string { return crypto.createHash('sha256').update(content).digest('hex').substring(0, 32); }
}
```

### 3.6 CircuitBreaker

States: closed -> open -> half_open -> closed. Threshold: 5 failures. Reset: 60s.

### 3.7 CacheAligner

Regex-based date extraction from system prompts. Replaces with `{{DATE_N}}` placeholders. Appends actual values at prompt end.

---

## 4. Database Design

```sql
CREATE TABLE IF NOT EXISTS ccr_store (
  key TEXT PRIMARY KEY,
  original TEXT NOT NULL,
  content_type TEXT NOT NULL,
  compressed_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_accessed INTEGER NOT NULL,
  size_bytes INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ccr_expires ON ccr_store(expires_at);
CREATE INDEX IF NOT EXISTS idx_ccr_lru ON ccr_store(last_accessed);
```

Migration: `CREATE TABLE IF NOT EXISTS` on first use. No migration framework needed.

---

## 5. API Design

### 5.1 MCP Tool: ccr_retrieve

```typescript
{
  name: 'ccr_retrieve',
  description: 'Retrieve original uncompressed content by CCR key',
  inputSchema: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] },
  handler: (args) => ccrStore.retrieve(args.key) ?? { error: 'Content not available' }
}
```

### 5.2 Internal API

```typescript
export function createCompressionPipeline(db: Database): CompressionPipeline;
```

---

## 6. Integration Design

**File:** `src/http/chat-routes.ts`

```typescript
// Add at top:
import { createCompressionPipeline } from '../compression';
const compressionPipeline = createCompressionPipeline(getDatabase());

// In processChatRequest(), after: const apiMessages = history.getMessages();
const compressedMessages = compressionPipeline.compress(apiMessages, sessionId);
// Replace in requestBody: messages: compressedMessages
```

---

## 7. Security Design

| Concern | Mitigation |
|---------|------------|
| CCR contains conversation data | TTL expiration (1h); SQLite file perms |
| Cache key collision | SHA-256/128-bit: negligible collision probability |
| CCR key guessing | UUID v4: 122 bits entropy |
| No injection risk | Compression only removes data, never adds external content |

---

## 8. Performance Design

| Operation | Budget | Approach |
|-----------|--------|----------|
| ContentRouter.detect | < 0.5ms | charAt check before JSON.parse |
| SmartCrusher.compress (100 items) | < 5ms | O(n*fields) analysis + O(n) sampling |
| CompressionCache.lookup | < 0.05ms | Map.get O(1) |
| CCRStore.store | < 2ms | Prepared statement, WAL mode |
| CacheAligner.align | < 0.5ms | 3 regex passes |
| **Total pipeline** | **< 10ms** | Sum with margin |

---

## 9. Error Handling

| Error | Fallback | Log Level |
|-------|----------|-----------|
| ContentDetectionError | type = "text" | warn |
| CompressionTimeout | return original | warn |
| CCRStoreError | compress without storing | error |
| CacheError | bypass cache | warn |
| Any unexpected | return original (failsafe) | error |

---

## 10. Testing Strategy

| Level | Focus | Count |
|-------|-------|-------|
| Unit | ContentRouter detection accuracy | 15+ |
| Unit | SmartCrusher ratio + strategy | 20+ |
| Unit | Cache hit/miss/eviction | 10+ |
| Unit | CircuitBreaker state transitions | 8+ |
| Integration | Full pipeline end-to-end | 5+ |
| Integration | chat-routes with compression | 3+ |
| Benchmark | p99 < 10ms verification | 1 suite |

---

## 11. Implementation Checklist

### Files to Create

| # | File | Purpose |
|---|------|---------|
| 1 | `src/compression/types.ts` | Shared interfaces |
| 2 | `src/compression/content-router.ts` | Content detection |
| 3 | `src/compression/smart-crusher.ts` | JSON compression |
| 4 | `src/compression/ccr-store.ts` | SQLite CCR persistence |
| 5 | `src/compression/compression-cache.ts` | Two-tier LRU |
| 6 | `src/compression/circuit-breaker.ts` | Resilience |
| 7 | `src/compression/cache-aligner.ts` | Date extraction |
| 8 | `src/compression/metrics.ts` | Metrics |
| 9 | `src/compression/index.ts` | Public API + factory |
| 10 | `src/tools/ccr-retrieve.ts` | MCP tool |

### Files to Modify

| # | File | Change |
|---|------|--------|
| 1 | `src/http/chat-routes.ts` | Import + use pipeline |
| 2 | Tool registry | Register ccr_retrieve |

### Sprint Map

| Sprint | Scope | Duration |
|--------|-------|----------|
| Sprint 2 | types, content-router, smart-crusher, cache | 2 weeks |
| Sprint 3 | cache-aligner, circuit-breaker, metrics | 1 week |
| Sprint 4 | ccr-store, index, ccr-retrieve, integration | 1 week |

---

## 12. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
