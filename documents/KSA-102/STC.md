# Software Test Cases (STC)

## KSA-102: Adaptive Token Cache + Model Manager for multilingual find_tools

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-102 |
| Title | Adaptive Token Cache + Model Manager — Test Cases |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-21 |
| Status | Draft |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-21 | QA Agent | Initial test cases |

---

## Property-Based Tests (PBT)

### PBT-01: Token Normalization is Idempotent

| Field | Value |
|-------|-------|
| **ID** | PBT-01 |
| **Priority** | High |
| **Type** | Automated (pytest + hypothesis) |
| **Requirement** | UC-1, BR-2 |
| **Preconditions** | tokenize() function available |

**Property:** For any string `s`, `tokenize(tokenize(s)) == tokenize(s)` (normalizing twice gives same result).

**Test Data:** Random strings (ASCII + Unicode, 1-500 chars)

---

### PBT-02: Token Normalization is Order-Independent

| Field | Value |
|-------|-------|
| **ID** | PBT-02 |
| **Priority** | High |
| **Type** | Automated (pytest + hypothesis) |
| **Requirement** | UC-1, BR-2 |
| **Preconditions** | tokenize() function available |

**Property:** For any words `a b c`, `tokenize("a b c") == tokenize("c a b")` (token set is unordered).

**Test Data:** Random word lists (1-10 words)

---

### PBT-03: Fuzzy Match Threshold Correctness

| Field | Value |
|-------|-------|
| **ID** | PBT-03 |
| **Priority** | High |
| **Type** | Automated (pytest + hypothesis) |
| **Requirement** | BR-2 |
| **Preconditions** | AdaptiveTokenCache instantiated |

**Property:** Given cached tokens `T` and query tokens `Q`, cache hit occurs IFF `|T ∩ Q| / |T| >= 0.80`.

**Test Data:** Random token sets (1-20 tokens each)

---

### PBT-04: LRU Eviction Maintains Max Size

| Field | Value |
|-------|-------|
| **ID** | PBT-04 |
| **Priority** | Medium |
| **Type** | Automated (pytest + hypothesis) |
| **Requirement** | BR-3, BR-4 |
| **Preconditions** | Cache with max_size=100 (test scale) |

**Property:** After any sequence of add operations, `cache.size <= max_size`.

**Test Data:** Random sequences of 200+ add operations

---

## Unit Tests (UT)

### UT-01: Cache Lookup — Exact Token Match

| Field | Value |
|-------|-------|
| **ID** | UT-01 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-1 AF-1 |
| **Preconditions** | Cache has entry: tokens={"search","jira"}, tool_name="jira_search" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call cache.find_fuzzy({"search","jira"}) | Returns CacheEntry with tool_name="jira_search" |
| 2 | Check hit_count | hit_count incremented by 1 |

---

### UT-02: Cache Lookup — Fuzzy Match (80% overlap)

| Field | Value |
|-------|-------|
| **ID** | UT-02 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | BR-2 |
| **Preconditions** | Cache has entry: tokens={"search","jira","issues","board","sprint"} |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call cache.find_fuzzy({"search","jira","issues","board"}) — 4/5=80% | Returns cache hit |
| 2 | Call cache.find_fuzzy({"search","jira","issues"}) — 3/5=60% | Returns None (below threshold) |

---

### UT-03: Cache Lookup — Miss (No Match)

| Field | Value |
|-------|-------|
| **ID** | UT-03 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-1 |
| **Preconditions** | Cache has entry for "jira_search" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call cache.find_fuzzy({"deploy","kubernetes"}) | Returns None |

---

### UT-04: Cache Add — New Entry Created

| Field | Value |
|-------|-------|
| **ID** | UT-04 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-1 AF-2, BR-1 |
| **Preconditions** | Empty cache |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call cache.add({"search","jira"}, "jira_search", 0.87, "hash123") | Entry created |
| 2 | Verify entry fields | tokens sorted, score=0.87, hit_count=0, tool_version="hash123" |
| 3 | Call cache.find_fuzzy({"search","jira"}) | Returns the new entry |

---

### UT-05: Cache Add — Score Below Threshold Rejected

| Field | Value |
|-------|-------|
| **ID** | UT-05 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | BR-1 |
| **Preconditions** | Empty cache |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call cache.add({"test"}, "some_tool", 0.60, "hash") | Entry NOT created (score < 0.75) |
| 2 | Verify cache.size | Remains 0 |

---

### UT-06: Cache Invalidation — Stale Entries Skipped

| Field | Value |
|-------|-------|
| **ID** | UT-06 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | BR-5, Story 7 |
| **Preconditions** | Cache has entry with tool_version="old_hash" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call cache.invalidate_stale("new_hash") | Returns count=1 (stale entries marked) |
| 2 | Call cache.find_fuzzy() for stale entry | Returns None (skipped) |

---

### UT-07: Cache LRU Eviction

| Field | Value |
|-------|-------|
| **ID** | UT-07 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | BR-3, BR-4 |
| **Preconditions** | Cache with max_size=3, already has 3 entries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add 4th entry | cache.size remains 3 |
| 2 | Verify evicted entry | Entry with oldest last_hit is removed |

---

### UT-08: Cache Persistence — Save to JSON

| Field | Value |
|-------|-------|
| **ID** | UT-08 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | BR-6, Story 6 |
| **Preconditions** | Cache with 2 entries, tmp file path |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call persistence.save(cache) | JSON file written |
| 2 | Read file content | Valid JSON with version=1, 2 entries |
| 3 | Verify atomic write | .tmp file does not remain |

---

### UT-09: Cache Persistence — Load from JSON

| Field | Value |
|-------|-------|
| **ID** | UT-09 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | Story 6 |
| **Preconditions** | Valid token-cache.json exists |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call cache.load() | Cache populated from file |
| 2 | Verify cache.size | Matches entry count in file |

---

### UT-10: Cache Persistence — Corrupted File Recovery

| Field | Value |
|-------|-------|
| **ID** | UT-10 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | FSD 9.1 |
| **Preconditions** | token-cache.json contains invalid JSON |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call cache.load() | No exception raised |
| 2 | Verify cache.size | 0 (empty cache) |
| 3 | Check logs | Warning logged about corrupted file |

---

### UT-11: Model Manager — List Models

| Field | Value |
|-------|-------|
| **ID** | UT-11 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | UC-2 |
| **Preconditions** | Model catalog configured |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call model_manager.execute({"action":"list"}) | Returns JSON with 2 models |
| 2 | Verify model fields | name, size_mb, languages, downloaded, active present |

---

### UT-12: Model Manager — Switch Model (Downloaded)

| Field | Value |
|-------|-------|
| **ID** | UT-12 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-4, BR-13 |
| **Preconditions** | Both models downloaded, English active |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call execute({"action":"switch","model_name":"paraphrase-multilingual-MiniLM-L12-v2"}) | Success |
| 2 | Verify active model changed | registry.active_model updated |
| 3 | Verify cache cleared | token cache size = 0 |

---

### UT-13: Model Manager — Switch Model (Not Downloaded)

| Field | Value |
|-------|-------|
| **ID** | UT-13 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-4 EF-1 |
| **Preconditions** | Multilingual model NOT downloaded |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call execute({"action":"switch","model_name":"paraphrase-multilingual-MiniLM-L12-v2"}) | Error returned |
| 2 | Verify error message | "Model not downloaded. Use action='download' first." |

---

### UT-14: Model Manager — Invalid Action

| Field | Value |
|-------|-------|
| **ID** | UT-14 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | FSD 3.2.6 |
| **Preconditions** | None |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call execute({"action":"invalid"}) | Error returned |
| 2 | Verify error message | "Invalid action. Use: list, download, status, switch" |

---

## Integration Tests (IT)

### IT-01: find_tools — Tier 1 Registry Hit (Cache Not Consulted)

| Field | Value |
|-------|-------|
| **ID** | IT-01 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-1 Main Flow |
| **Preconditions** | Registry has tool "jira_search" with matching tokens |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call find_tools(query="jira_search") | Tool returned from registry |
| 2 | Verify cache not accessed | No cache hit/miss logged |

---

### IT-02: find_tools — Tier 2 Cache Hit

| Field | Value |
|-------|-------|
| **ID** | IT-02 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-1 AF-1 |
| **Preconditions** | Registry miss, cache has entry for "search jira" → "jira_search" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call find_tools(query="search jira") | Returns "jira_search" from cache |
| 2 | Verify embedding NOT called | No ONNX inference |
| 3 | Verify hit_count incremented | Cache entry hit_count += 1 |

---

### IT-03: find_tools — Tier 3 Embedding Hit + Cache Learn

| Field | Value |
|-------|-------|
| **ID** | IT-03 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-1 AF-2, BR-1 |
| **Preconditions** | Registry miss, cache miss, mock ONNX returns score=0.87 for "jira_search" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call find_tools(query="find jira tickets") | Returns "jira_search" |
| 2 | Verify cache entry created | New entry with score=0.87 |
| 3 | Call same query again | Returns from cache (no embedding) |

---

### IT-04: find_tools — All Tiers Miss

| Field | Value |
|-------|-------|
| **ID** | IT-04 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-1 |
| **Preconditions** | Registry miss, cache miss, embedding returns score < 0.75 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call find_tools(query="completely unrelated xyz") | Empty array returned |
| 2 | Verify no cache entry created | Cache size unchanged |

---

### IT-05: find_tools — No Model Available (Graceful Degradation)

| Field | Value |
|-------|-------|
| **ID** | IT-05 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | EF-1 |
| **Preconditions** | No ONNX model installed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call find_tools(query="search jira") with no model | Falls through to delegate/KB |
| 2 | Verify no error raised | No exception, no crash |
| 3 | Verify auto-download triggered | Background download initiated |

---

### IT-06: find_tools — Embedding Timeout

| Field | Value |
|-------|-------|
| **ID** | IT-06 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | BR-7, EF-2 |
| **Preconditions** | Mock ONNX with 200ms delay |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call find_tools(query="slow query") | Falls through (timeout at 100ms) |
| 2 | Verify timeout logged | Warning in stderr |

---

### IT-07: Cache Invalidation on Server Startup

| Field | Value |
|-------|-------|
| **ID** | IT-07 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | BR-5, Story 7 |
| **Preconditions** | Cache file with entries from old registry hash |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start server with different tool set | Cache loaded |
| 2 | Verify stale entries marked | Entries with old hash skipped |
| 3 | Call find_tools for previously cached query | Cache miss (stale), falls to embedding |

---

### IT-08: Model Switch Invalidates Cache

| Field | Value |
|-------|-------|
| **ID** | IT-08 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | BR-13, UC-4 |
| **Preconditions** | Cache has entries, both models downloaded |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify cache has entries | cache.size > 0 |
| 2 | Call mem_model_manager(action="switch", model_name="paraphrase-multilingual-MiniLM-L12-v2") | Success |
| 3 | Verify cache cleared | cache.size = 0 |

---

## E2E-API Tests

### E2E-API-01: mem_model_manager — List Models via MCP Protocol

| Field | Value |
|-------|-------|
| **ID** | E2E-API-01 |
| **Priority** | Medium |
| **Type** | Automated (MCP client + pytest) |
| **Requirement** | UC-2, FSD 3.2.6 |
| **Preconditions** | MCP server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send MCP tools/call: mem_model_manager(action="list") | 200 OK |
| 2 | Verify response JSON | models array with name, size_mb, languages, downloaded, active |
| 3 | Verify at least 2 models in catalog | all-MiniLM-L6-v2 and paraphrase-multilingual present |

---

### E2E-API-02: mem_model_manager — Status

| Field | Value |
|-------|-------|
| **ID** | E2E-API-02 |
| **Priority** | Medium |
| **Type** | Automated (MCP client + pytest) |
| **Requirement** | FSD 3.2.6 |
| **Preconditions** | MCP server running, default model active |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send MCP tools/call: mem_model_manager(action="status") | 200 OK |
| 2 | Verify response | active_model, model_path, dimensions=384, cache_entries fields present |

---

### E2E-API-03: mem_model_manager — Invalid Action Error

| Field | Value |
|-------|-------|
| **ID** | E2E-API-03 |
| **Priority** | Medium |
| **Type** | Automated (MCP client + pytest) |
| **Requirement** | FSD 3.2.6 |
| **Preconditions** | MCP server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send MCP tools/call: mem_model_manager(action="invalid") | Error response |
| 2 | Verify error message | Contains "Invalid action" |

---

### E2E-API-04: find_tools — Semantic Query Returns Result

| Field | Value |
|-------|-------|
| **ID** | E2E-API-04 |
| **Priority** | High |
| **Type** | Automated (MCP client + pytest) |
| **Requirement** | UC-1, Story 1 |
| **Preconditions** | MCP server running, model available, tools registered |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send find_tools(query="search knowledge base semantic") | Returns matching tool(s) |
| 2 | Verify result contains tool with relevant name | Tool definition returned |

---

### E2E-API-05: find_tools — Empty Query Error

| Field | Value |
|-------|-------|
| **ID** | E2E-API-05 |
| **Priority** | Medium |
| **Type** | Automated (MCP client + pytest) |
| **Requirement** | FSD 3.1.5 |
| **Preconditions** | MCP server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send find_tools(query="") | Error response |
| 2 | Verify error | Empty query rejected |

---

### E2E-API-06: find_tools — Cache Learning Verified via Repeated Call

| Field | Value |
|-------|-------|
| **ID** | E2E-API-06 |
| **Priority** | High |
| **Type** | Automated (MCP client + pytest) |
| **Requirement** | Story 2 |
| **Preconditions** | MCP server running, model available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send find_tools(query="search jira issues") — first call | Result returned (embedding search) |
| 2 | Send same query again | Same result returned (faster — from cache) |
| 3 | Verify via mem_model_manager(action="status") | cache_entries incremented |

---

## SIT Tests (Manual)

### SIT-01: Model Download from HuggingFace

| Field | Value |
|-------|-------|
| **ID** | SIT-01 |
| **Priority** | Medium |
| **Type** | Manual |
| **Requirement** | UC-3, Story 4 |
| **Preconditions** | Network available, no models downloaded |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Delete ~/.code-intel/models/ directory | Clean state |
| 2 | Call mem_model_manager(action="download", model_name="all-MiniLM-L6-v2") | Download starts |
| 3 | Wait for completion | Success message with path and size |
| 4 | Verify files exist | model.onnx + vocab.txt in ~/.code-intel/models/all-MiniLM-L6-v2/ |
| 5 | Verify registry.json updated | Model marked as downloaded |

---

### SIT-02: Multilingual Model Reminder

| Field | Value |
|-------|-------|
| **ID** | SIT-02 |
| **Priority** | Low |
| **Type** | Manual |
| **Requirement** | Story 5, BR-12 |
| **Preconditions** | English-only model active |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call find_tools(query="tìm kiếm jira") | No embedding result (English model) |
| 2 | Check response | Contains multilingual model hint |
| 3 | Call another Vietnamese query | No duplicate hint (once per session) |

---

### SIT-03: Auto-Download on First Use

| Field | Value |
|-------|-------|
| **ID** | SIT-03 |
| **Priority** | Medium |
| **Type** | Manual |
| **Requirement** | Story 4, BR-10 |
| **Preconditions** | No model installed, network available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start fresh server (no models) | Server starts normally |
| 2 | Call find_tools with query that misses registry | Falls through to delegate (no embedding yet) |
| 3 | Check stderr logs | "Downloading all-MiniLM-L6-v2..." message |
| 4 | Wait for download, call find_tools again | Embedding search now active |

---

### SIT-04: Cache Survives Server Restart

| Field | Value |
|-------|-------|
| **ID** | SIT-04 |
| **Priority** | High |
| **Type** | Manual |
| **Requirement** | Story 6 |
| **Preconditions** | Server running, cache has learned entries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call find_tools to populate cache | Cache entry created |
| 2 | Verify .code-intel/token-cache.json exists | File present with entries |
| 3 | Restart MCP server | Server starts |
| 4 | Call same find_tools query | Result from cache (no embedding call) |

---

## Requirements Traceability Matrix (RTM)

| Requirement | Source | Test Cases | Coverage |
|-------------|--------|------------|----------|
| UC-1 Main Flow | FSD 3.1.2 | IT-01 | ✅ |
| UC-1 AF-1 (Cache Hit) | FSD 3.1.2 | UT-01, UT-02, UT-03, IT-02 | ✅ |
| UC-1 AF-2 (Embedding + Learn) | FSD 3.1.2 | UT-04, IT-03 | ✅ |
| UC-1 EF-1 (No Model) | FSD 3.1.2 | IT-05 | ✅ |
| UC-1 EF-2 (Timeout) | FSD 3.1.2 | IT-06 | ✅ |
| UC-2 (List Models) | FSD 3.2.2 | UT-11, E2E-API-01 | ✅ |
| UC-3 (Download Model) | FSD 3.2.3 | SIT-01 | ✅ |
| UC-4 (Switch Model) | FSD 3.2.4 | UT-12, UT-13, IT-08 | ✅ |
| BR-1 (Score > 0.75) | FSD 3.1.3 | UT-04, UT-05, IT-03 | ✅ |
| BR-2 (80% fuzzy match) | FSD 3.1.3 | PBT-03, UT-02 | ✅ |
| BR-3 (Max 10K entries) | FSD 3.1.3 | PBT-04, UT-07 | ✅ |
| BR-4 (LRU eviction) | FSD 3.1.3 | PBT-04, UT-07 | ✅ |
| BR-5 (Invalidation) | FSD 3.1.3 | UT-06, IT-07 | ✅ |
| BR-6 (Debounced persist) | FSD 3.1.3 | UT-08 | ✅ |
| BR-7 (100ms timeout) | FSD 3.1.3 | IT-06 | ✅ |
| BR-9 (Global model path) | FSD 3.2.5 | SIT-01 | ✅ |
| BR-10 (Auto-download) | FSD 3.2.5 | IT-05, SIT-03 | ✅ |
| BR-12 (Multilingual hint once) | FSD 3.2.5 | SIT-02 | ✅ |
| BR-13 (Switch clears cache) | FSD 3.2.5 | UT-12, IT-08 | ✅ |
| Story 1 (Semantic search) | BRD 2.3 | IT-03, E2E-API-04 | ✅ |
| Story 2 (Self-learning) | BRD 2.3 | UT-04, IT-03, E2E-API-06 | ✅ |
| Story 4 (Auto-download) | BRD 2.3 | IT-05, SIT-03 | ✅ |
| Story 5 (Multilingual hint) | BRD 2.3 | SIT-02 | ✅ |
| Story 6 (Persistence) | BRD 2.3 | UT-08, UT-09, UT-10, SIT-04 | ✅ |
| Story 7 (Invalidation) | BRD 2.3 | UT-06, IT-07 | ✅ |
| Corrupted cache recovery | FSD 9.1 | UT-10 | ✅ |
| Token normalization | FSD 6.1 | PBT-01, PBT-02 | ✅ |
| Empty query error | FSD 3.1.5 | E2E-API-05 | ✅ |
| Invalid action error | FSD 3.2.6 | UT-14, E2E-API-03 | ✅ |
