# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-244: Context Compression Module - Port Headroom Algorithms to Node.js

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-244 |
| Title | Context Compression Module - Port Headroom Algorithms to Node.js |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | TA Agent – Technical Analyst | Review technical accuracy |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-14 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-244 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

This change request covers the implementation of an internal context compression module within the mcp-code-intelligence-nodejs system. The module ports selected algorithms from the Headroom project (https://github.com/chopratejas/headroom) to Node.js/TypeScript, enabling 60-95% token reduction before messages are sent to the LLM API.

The module integrates directly into the existing chat-routes.ts HTTP handler, compressing conversation messages transparently before calling the Anthropic API. It leverages existing infrastructure (SQLite WAL, Tree-sitter, ONNX Runtime) and introduces zero new external dependencies.

### 1.2 Out of Scope

- CodeCompressor (AST-based compression) — deferred to future sprint
- LogCompressor (log-specific compression) — deferred
- SearchCompressor (search result compression) — deferred
- Kompress-base (general text compression) — deferred
- Python Headroom server deployment or integration
- npm headroom-ai SDK as production dependency (validation only in Sprint 1)
- UI/frontend changes
- Changes to MCP tool protocol or tool definitions (except new CCR retrieve tool)

### 1.3 Preliminary Requirement

- Existing mcp-code-intelligence-nodejs codebase with chat-routes.ts
- SQLite WAL + FTS5 database infrastructure operational
- Node.js 18+ runtime environment
- Access to Headroom source code for algorithm analysis

---

## 2. Business Requirements

### 2.1 High Level Process Map

The context compression module sits between the user's chat request and the LLM API call. When a chat message arrives at chat-routes.ts, the ContentRouter detects the content type of each message, routes it to the appropriate compressor (SmartCrusher for JSON, pass-through for others in v1), compresses the content, and forwards the reduced payload to the Anthropic API. Original content is stored in the CCR Store for on-demand retrieval by the LLM.

![Business Flow](diagrams/business-flow.png)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case / Epic | Priority | Source Ticket |
|---|-------------------------|----------|---------------|
| 1 | As an AI agent, I want JSON array messages compressed before sending to LLM so that I stay within token limits | MUST HAVE | KSA-244 |
| 2 | As an AI agent, I want content type auto-detected so that the right compression strategy is applied | MUST HAVE | KSA-244 |
| 3 | As an AI agent, I want to retrieve original uncompressed content on demand so that I can access full details when needed | MUST HAVE | KSA-244 |
| 4 | As a system, I want dynamic dates extracted from system prompts so that KV cache hit rates improve | SHOULD HAVE | KSA-244 |
| 5 | As a system, I want compression results cached so that repeated similar content is compressed faster | SHOULD HAVE | KSA-244 |
| 6 | As an operator, I want compression to fail gracefully so that requests are never blocked by compression errors | MUST HAVE | KSA-244 |
| 7 | As a developer, I want zero new external dependencies so that the system remains self-contained | MUST HAVE | KSA-244 |
| 8 | As a system, I want compression overhead under 10ms so that user experience is not degraded | MUST HAVE | KSA-244 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** User sends chat message via HTTP POST to chat-routes.ts

**Step 2:** ContentRouter analyzes each message in the conversation array, detecting content type (JSON, code, logs, text, search results)

**Step 3:** For JSON array content, SmartCrusher performs field analysis to identify which fields carry the most semantic value

**Step 4:** SmartCrusher selects compression strategy (field reduction, item sampling, or hybrid) based on array structure

**Step 5:** SmartCrusher compresses the JSON array, selecting representative items that preserve meaning

**Step 6:** Original uncompressed content is stored in CCR Store with a retrieval key

**Step 7:** Compressed message (with CCR retrieval hint) is sent to Anthropic API

**Step 8:** If LLM needs full details, it calls the CCR retrieve MCP tool to get original content

> **Note:** If any compression step fails, the original message passes through unchanged (AC8 failsafe)

---

#### STORY 1: SmartCrusher — JSON Array Compression

> As an AI agent, I want JSON array messages compressed before sending to LLM so that I stay within token limits

**Requirement Details:**

1. SmartCrusher receives a JSON array (e.g., list of files, search results, tool outputs) and reduces it by 60-90% while preserving semantic meaning
2. Field analysis identifies which object fields carry the most information (entropy-based scoring)
3. Strategy selection chooses between: field reduction (drop low-value fields), item sampling (select representative items), or hybrid
4. Item selection uses statistical similarity to pick items that best represent the full dataset
5. Output includes a summary header indicating original count, compressed count, and compression ratio

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| input | JSON Array | Yes | The array to compress | `[{name: "file1.ts", size: 1024, ...}, ...]` |
| targetRatio | number | No | Desired compression ratio (0.1-0.9) | 0.3 (keep 30%) |
| preserveFields | string[] | No | Fields that must always be kept | `["name", "path"]` |

**Acceptance Criteria:**

1. Given a JSON array with 100+ items, when SmartCrusher compresses it, then output is 60-90% smaller (measured in tokens)
2. Given compressed output, when compared to original semantically, then key information (types, patterns, distributions) is preserved
3. Compression executes in under 10ms for arrays up to 1000 items
4. Output is valid JSON that can be parsed by LLM without errors

**Validation Rules:**

- Input must be a valid JSON array with at least 2 items
- If array has fewer than 5 items, skip compression (not worth the overhead)
- targetRatio must be between 0.1 and 0.9

**Error Handling:**

- Invalid JSON input: pass through unchanged, log warning
- Compression produces larger output: return original
- Timeout (>10ms): return original, log performance warning

---

#### STORY 2: ContentRouter — Content Type Detection

> As an AI agent, I want content type auto-detected so that the right compression strategy is applied

**Requirement Details:**

1. ContentRouter examines each message in a conversation array and classifies its content type
2. Supported content types: JSON (structured data), Code (source code), Logs (log output), Text (natural language), Search Results (search/query outputs)
3. Detection uses heuristics: JSON starts with `[` or `{`, Code has syntax patterns (imports, function definitions), Logs have timestamp patterns, Search Results have ranking/score patterns
4. Each content type maps to a compression strategy (v1: only JSON has SmartCrusher, others pass through)

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| content | string | Yes | Message content to classify | `[{"file": "main.ts", ...}]` |
| hint | string | No | Optional type hint from caller | `"json"` |

**Acceptance Criteria:**

1. Given a JSON array string, when ContentRouter classifies it, then type is "json" with >95% accuracy
2. Given source code, when ContentRouter classifies it, then type is "code"
3. Given log output with timestamps, when ContentRouter classifies it, then type is "logs"
4. Given natural language text, when ContentRouter classifies it, then type is "text"
5. Classification completes in under 1ms per message

**Error Handling:**

- Ambiguous content: default to "text" (no compression in v1)
- Empty content: skip, return "empty" type

---

#### STORY 3: CCR Store — Reversible Compression Storage

> As an AI agent, I want to retrieve original uncompressed content on demand so that I can access full details when needed

**Requirement Details:**

1. CCR (Context Compression and Retrieval) Store saves original content before compression
2. Each stored item has a unique retrieval key (UUID) embedded in the compressed output as a hint
3. LLM can call the `ccr_retrieve` MCP tool with the key to get original content
4. Store uses existing SQLite WAL database for persistence
5. TTL-based expiration: stored items expire after conversation session ends or after configurable timeout (default: 1 hour)
6. Store has size limits to prevent unbounded growth (configurable max entries, default: 1000)

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| key | UUID | Yes | Unique retrieval key | `"a1b2c3d4-..."` |
| original | string | Yes | Original uncompressed content | Full JSON array string |
| contentType | string | Yes | Type of stored content | `"json"` |
| compressedAt | ISO timestamp | Yes | When compression occurred | `"2025-07-14T10:00:00Z"` |
| expiresAt | ISO timestamp | Yes | When entry expires | `"2025-07-14T11:00:00Z"` |
| sizeBytes | number | Yes | Size of original content | 45000 |

**Acceptance Criteria:**

1. Given compressed content with a CCR key, when LLM calls `ccr_retrieve(key)`, then original content is returned in full
2. Given an expired key, when LLM calls `ccr_retrieve(key)`, then a clear "expired" error message is returned
3. Given store at capacity (1000 items), when new item is stored, then oldest item is evicted (LRU)
4. Store operations (save/retrieve) complete in under 5ms

**Error Handling:**

- Key not found: return error with message "Content not available — may have expired"
- Store write failure: log error, compression still proceeds (content just won't be retrievable)
- Database corruption: rebuild store from empty state, log critical error

---

#### STORY 4: CacheAligner — Date Extraction for KV Cache

> As a system, I want dynamic dates extracted from system prompts so that KV cache hit rates improve

**Requirement Details:**

1. System prompts often contain dynamic dates (e.g., "Today is July 14, 2025") that cause KV cache misses
2. CacheAligner identifies and extracts date/time references from system prompts
3. Dates are replaced with a stable placeholder before sending to LLM
4. The actual date is injected at a stable position (end of system prompt) so that the prefix remains cache-friendly
5. This improves KV cache hit rates by making the majority of the system prompt static

**Acceptance Criteria:**

1. Given a system prompt with "Today is July 14, 2025", when CacheAligner processes it, then the date is extracted and replaced with a placeholder
2. Given a processed prompt, when LLM reads it, then the actual date is still available (injected at end)
3. Given two requests 1 minute apart, when both go through CacheAligner, then the static prefix matches exactly (enabling KV cache hit)

**Error Handling:**

- No date found in prompt: pass through unchanged
- Ambiguous date format: preserve original (don't risk corruption)

---

#### STORY 5: CompressionCache — Two-Tier Caching

> As a system, I want compression results cached so that repeated similar content is compressed faster

**Requirement Details:**

1. Skip Set (Tier 1): A set of content hashes known to not benefit from compression (too small, already compressed, etc.). These are skipped immediately without running the compression algorithm.
2. Result Cache (Tier 2): An LRU cache of content hash to compressed result. If the same content appears again, return cached compressed version instantly.
3. Cache key is a fast hash (xxhash or FNV via Node.js crypto) of the input content
4. Cache has configurable max size (default: 500 entries for Result Cache, 10000 for Skip Set)

**Acceptance Criteria:**

1. Given content that was previously compressed, when the same content appears again, then cached result is returned in under 0.1ms
2. Given content in the skip set, when it appears, then compression is skipped entirely (no CPU spent)
3. Cache hit rate logged for monitoring
4. Cache entries evicted using LRU when at capacity

**Error Handling:**

- Cache corruption: clear cache, rebuild from empty (compression still works, just slower)

---

#### STORY 6: Graceful Failsafe

> As an operator, I want compression to fail gracefully so that requests are never blocked by compression errors

**Requirement Details:**

1. If any compression component throws an error, the original message passes through unchanged
2. Errors are logged with full context (component, input size, error message) but never surface to user
3. Circuit breaker pattern: if compression fails 5 times consecutively, disable compression for 60 seconds (auto-reset)
4. Performance timeout: if any single compression call exceeds 10ms, abort and return original

**Acceptance Criteria:**

1. Given a malformed input that causes SmartCrusher to throw, when the request flows through, then the original message reaches the LLM unchanged
2. Given 5 consecutive failures, when the 6th request arrives, then compression is bypassed entirely (circuit open)
3. Given circuit is open, when 60 seconds pass, then compression is re-enabled (circuit half-open then closed on success)
4. No compression failure ever results in a user-visible error or failed LLM request

---

#### STORY 7: Zero External Dependencies

> As a developer, I want zero new external dependencies so that the system remains self-contained

**Requirement Details:**

1. All compression algorithms implemented in pure TypeScript
2. Leverage existing infrastructure only: SQLite (already available), Tree-sitter (already available), ONNX Runtime (already available)
3. No npm packages added for compression functionality
4. Hash functions use Node.js built-in crypto module

**Acceptance Criteria:**

1. Given the compression module, when package.json is inspected, then no new dependencies are added
2. All compression logic is in `src/compression/` directory using only built-in Node.js APIs and existing project dependencies

---

#### STORY 8: Performance — Sub-10ms Overhead

> As a system, I want compression overhead under 10ms so that user experience is not degraded

**Requirement Details:**

1. Total compression pipeline (ContentRouter + SmartCrusher + CCR Store save) completes in under 10ms per message
2. Measured via benchmark suite with realistic data (100-item JSON arrays, 50KB messages)
3. Performance regression tests run in CI to detect degradation

**Acceptance Criteria:**

1. Given a 100-item JSON array (~50KB), when compression runs, then total time is under 10ms (p99)
2. Given a 1000-item JSON array (~500KB), when compression runs, then total time is under 50ms (p99)
3. Benchmark results are reproducible and logged

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| SQLite WAL + FTS5 | Infrastructure | N/A | Already available — used for CCR Store persistence |
| chat-routes.ts | System | N/A | Integration point — compression hooks into existing HTTP handler |
| Anthropic API | External | N/A | Downstream consumer of compressed messages |
| Node.js crypto | System | N/A | Built-in hash functions for cache keys |
| mem_search infrastructure | System | N/A | Existing selective retrieval achieving 87% savings — complementary system |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Product Owner | Development Team | Accept/reject feature, prioritize sprints | Project lead |
| Developer | Dev Agent | Implement compression module | KSA-244 assignee |
| QA | QA Agent | Verify compression accuracy and performance | Testing |
| Architect | SA Agent | Review technical design decisions | Design review |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Compression loses semantically important information | High | Medium | Benchmark with real conversation data; preserve key fields; allow LLM to retrieve originals via CCR |
| Performance overhead exceeds 10ms budget | Medium | Low | Profile early; use efficient algorithms (no regex in hot path); cache aggressively |
| CCR Store grows unbounded | Medium | Low | TTL expiration + LRU eviction + configurable limits |
| Algorithm port from Python introduces bugs | Medium | Medium | Extensive unit tests; compare output with Python reference implementation |
| SmartCrusher statistical analysis inaccurate for small arrays | Low | Medium | Skip compression for arrays < 5 items; validate with diverse test data |

### 5.2 Assumptions

- Anthropic API behavior remains unchanged (accepts any valid text in messages)
- JSON arrays are the most common compressible content type in current usage
- Existing SQLite infrastructure can handle additional CCR Store writes without performance impact
- LLM will correctly interpret compressed summaries and use CCR retrieve tool when it needs full details
- 60-90% compression ratio is achievable based on Headroom's published benchmarks

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Compression latency < 10ms (p99) | Per-message compression including ContentRouter + SmartCrusher + CCR Store |
| Performance | Cache hit returns < 0.1ms | CompressionCache tier-2 lookup |
| Reliability | Zero request failures from compression | Failsafe pass-through on any error |
| Reliability | Circuit breaker auto-recovery | 60s cooldown after 5 consecutive failures |
| Storage | CCR Store max 1000 entries | LRU eviction, TTL 1 hour default |
| Storage | CompressionCache max 500 results | LRU eviction |
| Maintainability | Zero external dependencies | Pure TypeScript, built-in Node.js APIs only |
| Testability | Benchmark suite included | Reproducible performance measurements |
| Monitoring | Compression metrics logged | Ratio, time, cache hits, failures |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-244 | Context Compression Module - Port Headroom Algorithms to Node.js | In Progress | Task | Main ticket |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| SmartCrusher | Headroom algorithm that compresses JSON arrays by analyzing field value and selecting representative items |
| ContentRouter | Component that detects content type and routes to appropriate compressor |
| CacheAligner | Component that extracts dynamic dates from system prompts to improve KV cache hits |
| CCR Store | Context Compression and Retrieval Store — saves originals for on-demand retrieval |
| CompressionCache | Two-tier cache (skip set + result cache) to avoid redundant compression |
| KV Cache | Key-Value cache used by LLM inference engines to avoid recomputing attention for unchanged prefixes |
| Headroom | Open-source Python project for AI context compression (github.com/chopratejas/headroom) |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| Headroom GitHub | https://github.com/chopratejas/headroom |
| Headroom npm SDK | https://www.npmjs.com/package/headroom-ai |
| chat-routes.ts | src/http/chat-routes.ts |
| Existing mem_search | src/tools/ (selective retrieval achieving 87% savings) |

### Sprint Plan

| Sprint | Duration | Deliverable | Key Metrics |
|--------|----------|-------------|-------------|
| Sprint 1 | 1 week | Validate headroom-ai SDK, measure savings | Actual compression ratios on real data |
| Sprint 2 | 2 weeks | Port SmartCrusher algorithm to TypeScript | 60-90% compression on benchmarks |
| Sprint 3 | 1 week | Port ContentRouter + CompressionCache | Content detection accuracy >95% |
| Sprint 4 | 1 week | CCR Store + chat-routes.ts integration | End-to-end working in production |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
