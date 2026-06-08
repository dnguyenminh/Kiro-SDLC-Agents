# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-244: Context Compression Module - Port Headroom Algorithms to Node.js

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-244 |
| Title | Context Compression Module - Port Headroom Algorithms to Node.js |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-244.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-14 | BA Agent | Initiate document from BRD KSA-244 |
| 1.0 | 2025-07-14 | TA Agent | Enrich with API contracts, pseudocode, technical details |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the Context Compression Module — an internal TypeScript module that compresses conversation messages before they reach the Anthropic LLM API. It details use cases, data flows, API contracts, business rules, and processing logic for SmartCrusher, ContentRouter, CacheAligner, CompressionCache, and CCR Store.

### 1.2 Scope

The module integrates into `mcp-code-intelligence-nodejs/src/http/chat-routes.ts` between message assembly and the Anthropic API call. It is a pure internal module with no external API surface except the new `ccr_retrieve` MCP tool.

### 1.3 Definitions and Acronyms

| Term | Definition |
|------|------------|
| CCR | Context Compression and Retrieval |
| SmartCrusher | JSON array compression algorithm (entropy-based field analysis + item selection) |
| ContentRouter | Content type detection and routing component |
| CacheAligner | Date extraction for KV cache optimization |
| Circuit Breaker | Resilience pattern: auto-disable failing component |
| LRU | Least Recently Used eviction policy |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-244.docx |
| chat-routes.ts | mcp-code-intelligence-nodejs/src/http/chat-routes.ts |
| Headroom source | https://github.com/chopratejas/headroom |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

The Context Compression Module sits inside the MCP Code Intelligence server, intercepting messages in chat-routes.ts before they reach the Anthropic API. All operations are local (CPU + SQLite).

**External actors:**
- **AI Agent (chat client):** Sends messages via POST /api/chat/completions
- **Anthropic API:** Receives compressed messages
- **LLM (via MCP):** Can call `ccr_retrieve` tool to get original content

### 2.2 System Architecture

Pipeline: `Request -> ContentRouter -> [SmartCrusher | PassThrough] -> CCR Store -> CompressionCache -> Anthropic API`

---

## 3. Functional Requirements

### 3.1 Feature: Content Type Detection (ContentRouter)

**Source:** BRD Story 2

#### 3.1.1 Description

ContentRouter classifies message content into: JSON, Code, Logs, Text, or SearchResults. In v1, only JSON triggers compression.

#### 3.1.2 Use Case

**Use Case ID:** UC-01
**Actor:** System (internal)
**Preconditions:** Message content is non-empty string
**Postconditions:** Content type classified, routing decision made

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | ContentRouter | Receive raw message content |
| 2 | | ContentRouter | Check if starts with `[` and valid JSON array |
| 3 | | ContentRouter | If JSON array: route to SmartCrusher |
| 4 | | ContentRouter | If not: apply heuristic classification |
| 5 | | ContentRouter | Return type + routing decision |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Content starts with `{` (object, not array) | Type "json_object", pass through |
| AF-02 | Caller provides type hint | Use hint, skip detection |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Empty content | Return "empty", skip |
| EF-02 | Content < 100 chars | Return "short", skip compression |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-01 | JSON array: content.trim() starts with `[`, JSON.parse succeeds, result is Array | BRD AC2 |
| BR-02 | Code heuristic: contains `import `, `function `, `class `, `const ` in first 500 chars | BRD AC2 |
| BR-03 | Log heuristic: >50% lines match timestamp pattern | BRD AC2 |
| BR-04 | Minimum size for compression: 100 characters | BRD AC7 |
| BR-05 | Default classification: "text" (no compression in v1) | BRD AC2 |

#### 3.1.4 Data Specifications

**Input:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| content | string | Yes | Non-null | Raw message content |
| hint | ContentType | No | Valid enum | Optional type override |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| type | ContentType | "json" / "code" / "logs" / "text" / "search" / "empty" / "short" |
| shouldCompress | boolean | Route to compressor? |
| compressor | string or null | "smartCrusher" or null |

#### 3.1.5 API Contract

```typescript
type ContentType = 'json' | 'json_object' | 'code' | 'logs' | 'text' | 'search' | 'empty' | 'short';

interface ContentClassification {
  type: ContentType;
  shouldCompress: boolean;
  compressor: 'smartCrusher' | null;
}

function detectContentType(content: string, hint?: ContentType): ContentClassification;
```

---

### 3.2 Feature: JSON Array Compression (SmartCrusher)

**Source:** BRD Story 1

#### 3.2.1 Description

SmartCrusher compresses JSON arrays by 60-90% using field entropy analysis + item selection.

#### 3.2.2 Use Case

**Use Case ID:** UC-02
**Actor:** System (called when type = "json")
**Preconditions:** Valid JSON array with 5+ items
**Postconditions:** Compressed string returned OR original if compression not beneficial

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | SmartCrusher | Receive parsed JSON array |
| 2 | | SmartCrusher | Phase 1: Field analysis (entropy scoring) |
| 3 | | SmartCrusher | Phase 2: Strategy selection |
| 4 | | SmartCrusher | Phase 3: Execute (field reduction / item sampling / hybrid) |
| 5 | | SmartCrusher | Add summary header |
| 6 | | SmartCrusher | Size comparison: if smaller, return compressed |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Array < 5 items | Skip, return original |
| AF-02 | All fields high entropy | Item sampling only |
| AF-03 | Primitive array (not objects) | Simple evenly-spaced sampling |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Exceeds 10ms timeout | Abort, return original |
| EF-02 | Output >= input size | Return original (skipped) |

#### 3.2.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-10 | Min array size: 5 items | BRD AC1 |
| BR-11 | Default target ratio: 0.3 (keep 30%) | BRD AC1 |
| BR-12 | Low entropy threshold: < 0.2 (< 20% unique values) | Headroom |
| BR-13 | preserveFields always kept | BRD Story 1 |
| BR-14 | Summary header format: `[COMPRESSED: N items -> M items (X% reduction)]` | Design |
| BR-15 | If compressed >= original, return original | BRD Story 1 |
| BR-16 | Max 10ms for arrays up to 1000 items | BRD AC7 |

#### 3.2.4 Data Specifications

**Input:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| items | any[] | Yes | isArray, length >= 2 | JSON array |
| options.targetRatio | number | No | 0.1-0.9 (default 0.3) | Keep ratio |
| options.preserveFields | string[] | No | — | Fields to always preserve |
| options.timeoutMs | number | No | > 0 (default 10) | Max processing time |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| compressed | string | Compressed output with header |
| originalSize | number | Original character count |
| compressedSize | number | Compressed character count |
| ratio | number | Compression ratio |
| strategy | string | "field_reduction" / "item_sampling" / "hybrid" |
| skipped | boolean | True if compression skipped |

#### 3.2.5 API Contract

```typescript
interface CompressionOptions {
  targetRatio?: number;    // 0.1-0.9, default 0.3
  preserveFields?: string[];
  timeoutMs?: number;      // default 10
}

interface CompressionResult {
  compressed: string;
  originalSize: number;
  compressedSize: number;
  ratio: number;
  strategy: 'field_reduction' | 'item_sampling' | 'hybrid';
  skipped: boolean;
}

function compressJsonArray(items: any[], options?: CompressionOptions): CompressionResult;
```

---

### 3.3 Feature: CCR Store (Reversible Compression)

**Source:** BRD Story 3

#### 3.3.1 Use Cases

**UC-03a: Store Original**

| Step | System | Description |
|------|--------|-------------|
| 1 | CCR Store | Generate UUID key (crypto.randomUUID) |
| 2 | CCR Store | INSERT: key, original, type, timestamps, size |
| 3 | CCR Store | If at capacity (1000): evict LRU entry |
| 4 | CCR Store | Return key (embedded in compressed output) |

**UC-03b: Retrieve Original (MCP Tool)**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | LLM | | Calls `ccr_retrieve(key)` |
| 2 | | CCR Store | SELECT WHERE key = ? AND expires_at > now |
| 3 | | CCR Store | Update last_accessed |
| 4 | | CCR Store | Return original content |

#### 3.3.2 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-20 | TTL: 3600 seconds (1 hour) | BRD Story 3 |
| BR-21 | Max entries: 1000 (configurable) | BRD Story 3 |
| BR-22 | Eviction: LRU | BRD Story 3 |
| BR-23 | Key: crypto.randomUUID() | BRD AC6 |
| BR-24 | Lazy cleanup + periodic sweep (every 100 stores) | Performance |

#### 3.3.3 MCP Tool Contract

**Tool:** `ccr_retrieve`

**Input:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| key | string | Yes | UUID from compressed message |

**Output (success):**
```json
{ "content": "<original>", "contentType": "json", "compressedAt": "ISO", "sizeBytes": 45000 }
```

**Output (error):**
```json
{ "error": "Content not available - may have expired", "key": "<key>" }
```

---

### 3.4 Feature: CacheAligner (Date Extraction)

**Source:** BRD Story 4

#### 3.4.1 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-30 | Patterns: "Today is {date}", ISO dates, relative dates | BRD AC3 |
| BR-31 | Only modify system prompts (role: "system") | Design |
| BR-32 | Skip ambiguous matches | BRD Story 4 |
| BR-33 | Placeholder format keeps prefix stable across calls | BRD AC3 |

#### 3.4.2 API Contract

```typescript
interface AlignedPrompt {
  prompt: string;       // Modified prompt with placeholders
  extractedDates: Array<{ placeholder: string; value: string }>;
  modified: boolean;    // True if any dates were extracted
}

function alignCacheDate(systemPrompt: string): AlignedPrompt;
```

---

### 3.5 Feature: CompressionCache (Two-Tier)

**Source:** BRD Story 5

#### 3.5.1 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-40 | Skip Set max: 10,000 entries (LRU) | BRD Story 5 |
| BR-41 | Result Cache max: 500 entries (LRU) | BRD Story 5 |
| BR-42 | Hash: SHA-256 truncated to 16 bytes (Node.js crypto) | BRD AC6 |
| BR-43 | Cache hit < 0.1ms | BRD NFR |
| BR-44 | In-memory only (no persistence) | Performance |

#### 3.5.2 API Contract

```typescript
interface CacheResult {
  hit: boolean;
  source: 'skip_set' | 'result_cache' | 'miss';
  result?: CompressionResult;
}

function cacheLookup(content: string): CacheResult;
function cacheStore(content: string, result: CompressionResult): void;
```

---

### 3.6 Feature: Circuit Breaker

**Source:** BRD Story 6

#### 3.6.1 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-50 | Threshold: 5 consecutive failures | BRD Story 6 |
| BR-51 | Open duration: 60 seconds | BRD Story 6 |
| BR-52 | Any exception = failure | BRD Story 6 |
| BR-53 | Timeout > 10ms = failure | BRD AC7 |
| BR-54 | Log state transitions | Monitoring |

---

### 3.7 Feature: Integration (chat-routes.ts)

**Source:** BRD AC5

#### 3.7.1 Integration Point

In `processChatRequest()`, between message assembly and API call:

```typescript
// CURRENT: const apiMessages = history.getMessages();
// INSERT after:
const compressedMessages = compressionPipeline.compress(apiMessages, sessionId);
// REPLACE in requestBody:
requestBody.messages = compressedMessages;
```

#### 3.7.2 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-60 | Only compress role "user"/"assistant" with string content | Design |
| BR-61 | Never compress tool_use or tool_result blocks | Design |
| BR-62 | System prompt: CacheAligner only (not SmartCrusher) | Design |
| BR-63 | If all compression skipped/failed, API call proceeds normally | BRD AC8 |

---

## 4. Data Model

### 4.1 CCR Store Schema (SQLite)

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

CREATE INDEX idx_ccr_expires ON ccr_store(expires_at);
CREATE INDEX idx_ccr_lru ON ccr_store(last_accessed);
```

---

## 5. Non-Functional Requirements

| Category | Requirement | Acceptance Criteria |
|----------|-------------|---------------------|
| Performance | Compression latency | < 10ms per message (p99) |
| Performance | Cache hit latency | < 0.1ms |
| Reliability | No request failures | Circuit breaker + failsafe |
| Storage | Bounded memory | Max 1000 CCR + 500 cache entries |
| Maintainability | Zero new dependencies | Pure TypeScript + Node.js crypto |
| Observability | Metrics logging | Ratio, time, hits, failures per request |

---

## 6. Error Handling

| Scenario | Severity | User Impact | Behavior |
|----------|----------|-------------|----------|
| Compression fails | Info | None | Original sent to LLM |
| CCR key expired | Warning | LLM informed | Error response to tool call |
| Circuit open | Info | None | Compression bypassed |
| Store full | Info | None | LRU eviction |

---

## 7. Appendix

### Sequence Diagram — Compression Pipeline

![Compression Pipeline](diagrams/sequence-compression.png)

### State Diagram — Circuit Breaker

![Circuit Breaker](diagrams/state-circuit-breaker.png)

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Compression Sequence | [sequence-compression.png](diagrams/sequence-compression.png) | [sequence-compression.drawio](diagrams/sequence-compression.drawio) |
| 3 | Circuit Breaker States | [state-circuit-breaker.png](diagrams/state-circuit-breaker.png) | [state-circuit-breaker.drawio](diagrams/state-circuit-breaker.drawio) |
