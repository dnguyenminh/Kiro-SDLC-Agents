# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-102: Adaptive Token Cache + Model Manager

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-102 |
| Title | Adaptive Token Cache + Model Manager for multilingual find_tools |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-05-21 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-102.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-21 | BA Agent | Initiate document from BRD |
| 1.0 | 2026-05-21 | TA Agent | Enriched with API contracts, pseudocode, technical review |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the Adaptive Token Cache and Model Manager features for the MCP Code Intelligence `find_tools` system. It defines use cases, data flows, API contracts, and processing logic that developers will implement.

### 1.2 Scope

- Adaptive Token Cache: self-learning cache layer between tokenized search and embedding search
- Model Manager: MCP tool for managing embedding models (list, download, status, switch)
- Implementation across Python MCP module (primary), with algorithm parity for Node.js and Kotlin

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| Token Cache | Per-workspace JSON file storing learned query→tool mappings |
| Embedding | 384-dimensional dense vector from ONNX model inference |
| Cosine Similarity | Dot product of normalized vectors measuring semantic closeness (0-1) |
| LRU | Least Recently Used — eviction strategy |
| Elicitation | MCP protocol pattern for interactive user input |
| Registry | In-memory index of all registered MCP tools |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | documents/KSA-102/BRD.md |
| Current find_tools | mcp-code-intelligence-python/src/mcp_code_intel/orchestration/meta/find_tools.py |
| Current tokenizer | mcp-code-intelligence-python/src/mcp_code_intel/orchestration/registry/tokenizer.py |
| ONNX provider | mcp-code-intelligence-python/src/mcp_code_intel/memory/embedding/onnx_provider.py |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

The system operates within the MCP Code Intelligence Python server. External actors:
- **Developer (AI Agent)**: Calls `find_tools(query)` to discover tools
- **HuggingFace Hub**: Source for downloading embedding models
- **Workspace filesystem**: Stores token cache (`.code-intel/token-cache.json`)
- **Global filesystem**: Stores models (`~/.code-intel/models/`)

### 2.2 System Architecture

The feature adds two new components to the existing orchestration layer:

1. **AdaptiveTokenCache** — sits between tokenized search and embedding search in `find_tools`
2. **ModelManager** — new MCP tool for model lifecycle management
3. **EmbeddingSearcher** — adapter connecting find_tools to the existing ONNX embedding provider

---

## 3. Functional Requirements

### 3.1 Feature: Adaptive Token Cache

**Source:** BRD Stories 1, 2, 6, 7

#### 3.1.1 Description

A self-learning cache that stores successful embedding search results as token→tool mappings. When a query misses tokenized search, the cache is checked before invoking the expensive embedding model. Over time, the cache grows and embedding calls decrease.

#### 3.1.2 Use Case: UC-1 — Find Tools with Cache

**Use Case ID:** UC-1
**Actor:** Developer (AI Agent)
**Preconditions:** MCP server is running, tools are registered in registry
**Postconditions:** Tool definitions returned OR empty array if no match

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Calls find_tools(query) | | Developer sends natural language query |
| 2 | | Tokenize query | Split query into normalized token set |
| 3 | | Search registry | Match tokens against registered tool tokens |
| 4 | | Return results | If registry has matches, return top 10 |

**Alternative Flow AF-1: Cache Hit**

| Step | Condition | Description |
|------|-----------|-------------|
| 3a | Registry returns no results | Proceed to cache lookup |
| 3b | Normalize query tokens | Create token set for cache key |
| 3c | Search cache (≥80% token overlap) | Find matching cache entry |
| 3d | Cache hit found | Return cached tool, increment hit_count |

**Alternative Flow AF-2: Embedding Search + Learn**

| Step | Condition | Description |
|------|-----------|-------------|
| 3e | Cache also misses | Proceed to embedding search |
| 3f | Check model available | Verify ONNX model exists |
| 3g | Compute query embedding | Run ONNX inference (~10-50ms) |
| 3h | Compare with tool embeddings | Cosine similarity against all tools |
| 3i | Best match score > 0.75 | Return tool AND cache the mapping |

**Exception Flow EF-1: No Model Available**

| Step | Condition | Description |
|------|-----------|-------------|
| 3f-err | Model not installed | Skip embedding, trigger auto-download in background |
| 3f-err2 | Fall through to delegate/KB | Continue with existing fallback chain |

**Exception Flow EF-2: Embedding Timeout**

| Step | Condition | Description |
|------|-----------|-------------|
| 3g-err | Inference takes > 100ms | Abort embedding search, fall through to delegate/KB |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-1 | Cache confidence threshold: only cache if embedding score > 0.75 | BRD Story 2 |
| BR-2 | Fuzzy cache match: ≥80% token overlap counts as hit | BRD Story 2 |
| BR-3 | Max cache size: 10,000 entries per workspace | BRD Story 6 |
| BR-4 | LRU eviction when cache exceeds max size | BRD Story 6 |
| BR-5 | Cache invalidation on tool registry change (hash mismatch) | BRD Story 7 |
| BR-6 | Debounced persistence: max 1 file write per 5 seconds | BRD Story 6 |
| BR-7 | Embedding search hard timeout: 100ms | BRD Story 1 |
| BR-8 | Cache entries with hit_count=0 after 30 days eligible for eviction | BRD Story 2 |

#### 3.1.4 Data Specifications

**Input Data (find_tools):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| query | string | Yes | Non-empty, max 500 chars | Natural language tool search query |

**Output Data (find_tools — unchanged):**

| Field | Type | Description |
|-------|------|-------------|
| tools | Array\<ToolDefinition\> | Top 10 matching tool definitions |
| tools[].name | string | Tool name |
| tools[].description | string | Tool description |
| tools[].input_schema | object | JSON Schema for tool parameters |

**Cache Entry Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| tokens | Array\<string\> | Yes | Sorted normalized token set |
| tool_name | string | Yes | Resolved tool name |
| score | float | Yes | Original embedding similarity (0.75-1.0) |
| timestamp | string | Yes | ISO8601 creation time |
| hit_count | int | Yes | Usage counter (starts at 0) |
| tool_version | string | Yes | Registry hash when entry was created |

#### 3.1.5 API Contract (Functional View)

**Tool:** `find_tools` (existing — enhanced behavior)
**Purpose:** Discover MCP tools by natural language query

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| query | string | Yes | Max 500 chars | Search query |

**Output Data:** (unchanged from current)

| Field | Type | Description |
|-------|------|-------------|
| (array) | ToolDefinition[] | Up to 10 matching tools |

**Business Error Scenarios:**

| Scenario | Behavior | Trigger Condition |
|----------|----------|-------------------|
| Empty query | Return error JSON | query is null/empty |
| No results anywhere | Return empty array | All tiers miss |
| Model not available | Skip embedding tier silently | ONNX model not installed |
| Cache corrupted | Reset cache, continue | JSON parse error on load |

---

### 3.2 Feature: Model Manager

**Source:** BRD Stories 3, 4, 5

#### 3.2.1 Description

A new MCP tool `mem_model_manager` that allows users to manage embedding models. Supports listing available models, downloading new ones, checking status, and switching the active model.

#### 3.2.2 Use Case: UC-2 — List Available Models

**Use Case ID:** UC-2
**Actor:** Developer
**Preconditions:** MCP server running
**Postconditions:** Model list returned with download status

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Calls mem_model_manager(action="list") | | Request model list |
| 2 | | Read registry.json | Load ~/.code-intel/models/registry.json |
| 3 | | Merge with known models | Combine registry with hardcoded model catalog |
| 4 | | Return model list | Each model: name, size, languages, downloaded status |

#### 3.2.3 Use Case: UC-3 — Download Model

**Use Case ID:** UC-3
**Actor:** Developer
**Preconditions:** Network available, model not yet downloaded
**Postconditions:** Model files saved to ~/.code-intel/models/{model_name}/

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Calls mem_model_manager(action="download", model_name="...") | | Request download |
| 2 | | Validate model_name | Check against known model catalog |
| 3 | | Download model.onnx | From HuggingFace (streaming) |
| 4 | | Download vocab.txt | From HuggingFace |
| 5 | | Update registry.json | Mark model as downloaded |
| 6 | | Return success | Include model path and size |

**Alternative Flow AF-1: Model Already Downloaded**

| Step | Condition | Description |
|------|-----------|-------------|
| 2a | Model files already exist | Return success immediately with "already downloaded" message |

**Exception Flow EF-1: Download Failure**

| Step | Condition | Description |
|------|-----------|-------------|
| 3-err | Network error or timeout | Return error with retry instructions, clean up partial files |

#### 3.2.4 Use Case: UC-4 — Switch Active Model

**Use Case ID:** UC-4
**Actor:** Developer
**Preconditions:** Target model is downloaded
**Postconditions:** Active model changed, tool embeddings rebuilt

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Calls mem_model_manager(action="switch", model_name="...") | | Request switch |
| 2 | | Verify model downloaded | Check files exist |
| 3 | | Update registry.json | Set active_model field |
| 4 | | Reload ONNX provider | Point to new model files |
| 5 | | Invalidate token cache | Clear all cached embeddings (model changed) |
| 6 | | Return success | Include new model info |

**Exception Flow EF-1: Model Not Downloaded**

| Step | Condition | Description |
|------|-----------|-------------|
| 2-err | Model files not found | Return error: "Model not downloaded. Use action='download' first." |

#### 3.2.5 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-9 | Models stored globally: ~/.code-intel/models/ | BRD Story 3 |
| BR-10 | Auto-download smallest model on first embedding need | BRD Story 4 |
| BR-11 | Never auto-download multilingual model (user opt-in only) | BRD Story 5 |
| BR-12 | Remind user about multilingual model max once per session | BRD Story 5 |
| BR-13 | Switching model invalidates entire token cache | BRD Story 7 |

#### 3.2.6 API Contract

**Tool:** `mem_model_manager` (new)
**Purpose:** Manage embedding models for semantic tool search

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| action | string | Yes | One of: list, download, status, switch | Action to perform |
| model_name | string | No | Required for download/switch | Model identifier |

**Output Data (action=list):**

| Field | Type | Description |
|-------|------|-------------|
| models | Array | Available models |
| models[].name | string | Model identifier |
| models[].display_name | string | Human-readable name |
| models[].size_mb | int | Download size in MB |
| models[].languages | Array\<string\> | Supported languages |
| models[].downloaded | boolean | Whether already on disk |
| models[].active | boolean | Whether currently in use |
| models[].vocab_size | int | Vocabulary size |

**Output Data (action=status):**

| Field | Type | Description |
|-------|------|-------------|
| active_model | string | Current model name |
| model_path | string | Path to model files |
| dimensions | int | Embedding vector dimensions |
| languages | Array\<string\> | Supported languages |
| cache_entries | int | Current token cache size |

**Output Data (action=download):**

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Download completed |
| model_name | string | Downloaded model |
| path | string | Where files were saved |
| size_mb | int | Total size downloaded |

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| Invalid action | "Invalid action. Use: list, download, status, switch" | action not in allowed set |
| Model not found | "Unknown model: {name}. Use action='list' to see available models" | model_name not in catalog |
| Download failed | "Download failed: {error}. Check network and retry." | Network error |
| Switch without download | "Model not downloaded. Use action='download' first." | Files don't exist |

---

## 4. Data Model

### 4.1 Logical Entities

#### Entity: TokenCacheEntry

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| tokens | Array\<string\> | Yes | BR-2 | Sorted normalized token set (cache key) |
| tool_name | string | Yes | | Resolved tool name |
| score | float | Yes | BR-1 (>0.75) | Embedding similarity score |
| timestamp | ISO8601 | Yes | | When entry was created |
| hit_count | int | Yes | BR-8 | Times this entry was used |
| tool_version | string | Yes | BR-5 | Registry hash at creation time |
| last_hit | ISO8601 | No | BR-4 (LRU) | Last time entry was accessed |

#### Entity: ModelRegistry

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| active_model | string | Yes | BR-13 | Currently active model name |
| models | Map\<string, ModelInfo\> | Yes | | Downloaded models |
| last_updated | ISO8601 | Yes | | Last registry modification |

#### Entity: ModelInfo

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Model identifier |
| path | string | Yes | Absolute path to model directory |
| downloaded_at | ISO8601 | Yes | When model was downloaded |
| size_bytes | int | Yes | Total size on disk |
| vocab_size | int | Yes | Vocabulary size |

**Relationships:**

| From Entity | To Entity | Cardinality | Description |
|-------------|-----------|-------------|-------------|
| TokenCacheEntry | Tool (Registry) | N:1 | Many cache entries can point to same tool |
| ModelRegistry | ModelInfo | 1:N | Registry tracks multiple downloaded models |

---

## 5. Integration Specifications

### 5.1 External System: HuggingFace Hub

| Attribute | Value |
|-----------|-------|
| Purpose | Download ONNX embedding models |
| Direction | Outbound (download only) |
| Data Format | Binary (model.onnx) + Text (vocab.txt) |
| Frequency | On-demand (user-triggered or first-use auto-download) |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| model_name | /resolve/main/onnx/model.onnx | Receive | BR-10: auto-download smallest |
| model_name | /resolve/main/vocab.txt | Receive | Download vocab alongside model |

### 5.2 Internal System: ONNX Runtime

| Attribute | Value |
|-----------|-------|
| Purpose | Local embedding inference |
| Direction | Bidirectional (send text, receive vector) |
| Data Format | numpy arrays (input_ids, attention_mask, token_type_ids → embeddings) |
| Frequency | Real-time (on cache miss) |

---

## 6. Processing Logic

### 6.1 Adaptive Search Process

**Trigger:** `find_tools(query)` called with no registry results
**Input:** query string, token cache, ONNX model
**Output:** ToolDefinition[] or empty

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Tokenize query → token_set | Return empty on invalid input |
| 2 | Search cache: find entry with ≥80% token overlap | Continue to step 3 on miss |
| 3 | If cache hit: increment hit_count, return tool | |
| 4 | Check ONNX model available | Skip to step 8 if unavailable |
| 5 | Compute query embedding (timeout 100ms) | Skip to step 8 on timeout |
| 6 | Compare with all tool embeddings (cosine similarity) | |
| 7 | If best score > 0.75: return tool + cache entry | |
| 8 | Fall through to delegate/KB fallback | |

**Pseudocode:**

```python
def adaptive_search(query: str, cache: TokenCache, embedder: OnnxProvider, registry: Registry) -> list[ToolDef]:
    # Step 1: Tokenize
    tokens = tokenize(query)
    
    # Step 2-3: Cache lookup (fuzzy)
    cached = cache.find_fuzzy(tokens, threshold=0.80)
    if cached:
        cached.hit_count += 1
        cached.last_hit = now()
        cache.schedule_persist()
        tool = registry.find(cached.tool_name)
        return [tool] if tool else []
    
    # Step 4: Check model
    if not embedder.is_available():
        trigger_auto_download()  # background, non-blocking
        return []
    
    # Step 5-6: Embedding search
    try:
        query_vec = embedder.embed(query, timeout_ms=100)
        best_tool, best_score = find_best_match(query_vec, registry.get_tool_embeddings())
    except TimeoutError:
        return []
    
    # Step 7: Cache if confident
    if best_score > 0.75:
        cache.add(tokens, best_tool.name, best_score, registry.version_hash())
        cache.schedule_persist()
        return [best_tool]
    
    return []
```

### 6.2 Cache Persistence Process

**Trigger:** New cache entry added (debounced 5s)
**Input:** In-memory cache state
**Output:** Updated token-cache.json file

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Check if persist timer already scheduled | Skip if timer pending |
| 2 | Wait 5 seconds (debounce) | |
| 3 | Serialize cache to JSON | Log error, skip write on serialization failure |
| 4 | Write to .code-intel/token-cache.json atomically | Write to .tmp then rename |
| 5 | Reset persist timer | |

### 6.3 Cache Invalidation Process

**Trigger:** Server startup OR new tools registered
**Input:** Current registry hash, cached entries
**Output:** Stale entries marked/removed

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Compute current registry version hash | Use empty hash on error |
| 2 | Compare each cache entry's tool_version with current | |
| 3 | Mark mismatched entries as stale (skip during lookup) | |
| 4 | On next persist: remove stale entries from file | |

---

## 7. Security Requirements

### 7.1 Authentication & Authorization

| Role | Permissions | Features |
|------|-------------|----------|
| Any MCP client | Full access | find_tools, mem_model_manager |

No authentication required — these are local tools running on user's machine.

### 7.2 Data Sensitivity

| Data Type | Classification | Business Requirement |
|-----------|---------------|---------------------|
| Token cache | Internal | Contains query patterns — workspace-local only |
| Model files | Public | Open-source models from HuggingFace |
| Registry.json | Internal | Local config — no secrets |

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | Cache lookup instant | < 1ms for 10K entries |
| Performance | Embedding search fast | < 100ms hard timeout |
| Performance | find_tools total latency | < 150ms worst case (cache miss + embedding) |
| Storage | Cache file manageable | < 5MB for 10K entries |
| Reliability | Works without model | Graceful degradation, no crash |
| Reliability | Survives corrupted cache | Reset and continue |
| Startup | No blocking downloads | Auto-download is background-only |

---

## 9. Error Handling (User-Facing)

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| No model installed | Info | (silent — falls through to delegate) | System works, just slower |
| Cache corrupted | Warning | Log: "Token cache corrupted, starting fresh" | Reset cache, continue |
| Download network error | Warning | "Download failed: {error}. Retry later." | System continues without model |
| ONNX Runtime missing | Info | (silent — embedding tier disabled) | Tokenized + delegate still work |
| Model switch while queries in-flight | Warning | (none — atomic swap) | In-flight queries use old model, next query uses new |

### 9.2 Notification Requirements

| Event | Who is Notified | Channel | Timing |
|-------|----------------|---------|--------|
| Multilingual model suggestion | Developer | find_tools response hint | Once per session, on non-ASCII query miss |
| Model download complete | Developer | stderr log | Immediate |
| Cache invalidation | Developer | stderr log | On startup if tools changed |

---

## 10. Testing Considerations

### 10.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-1 | Tokenized search hit (no cache needed) | query matching registry tokens | Tool returned, cache not consulted | High |
| TC-2 | Cache hit (fuzzy match) | query with 80%+ token overlap with cached entry | Cached tool returned, hit_count++ | High |
| TC-3 | Embedding hit + cache learn | query with no token/cache match, embedding score > 0.75 | Tool returned, new cache entry created | High |
| TC-4 | All tiers miss | query with no match anywhere | Empty array, falls to delegate/KB | High |
| TC-5 | Cache persistence | Add entry, wait 5s | token-cache.json updated | Medium |
| TC-6 | Cache invalidation on tool change | Change registry, restart | Stale entries skipped | High |
| TC-7 | Model manager list | action="list" | All models with status | Medium |
| TC-8 | Model manager download | action="download", model_name valid | Model files saved | Medium |
| TC-9 | Model manager switch | action="switch", model downloaded | Active model changed, cache cleared | High |
| TC-10 | Auto-download on first use | No model, embedding tier reached | Background download starts | Medium |
| TC-11 | Multilingual reminder | Non-ASCII query, English model, no results | Hint in response (once) | Low |
| TC-12 | Cache LRU eviction | Cache at 10K, add new entry | Oldest unused entry removed | Medium |
| TC-13 | Corrupted cache file | Invalid JSON in token-cache.json | Cache reset, no crash | High |
| TC-14 | Embedding timeout | Slow model inference > 100ms | Timeout, fall through | High |

---

## 11. Appendix

### Sequence Diagram: find_tools with Adaptive Cache

![Sequence Diagram](diagrams/sequence-find-tools.png)

### State Diagram: Cache Entry Lifecycle

![State Diagram](diagrams/state-cache-entry.png)

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence: find_tools with Cache | [sequence-find-tools.png](diagrams/sequence-find-tools.png) | [sequence-find-tools.drawio](diagrams/sequence-find-tools.drawio) |
| 3 | State: Cache Entry Lifecycle | [state-cache-entry.png](diagrams/state-cache-entry.png) | [state-cache-entry.drawio](diagrams/state-cache-entry.drawio) |

### Change Log from BRD

- Added detailed pseudocode for adaptive search algorithm
- Specified fuzzy cache match threshold at 80% token overlap
- Added atomic file write requirement for cache persistence
- Clarified model switch invalidates entire cache (not just affected entries)
