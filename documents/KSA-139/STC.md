# Software Test Cases (STC)

## MCP Code Intelligence — KSA-139: 2-Level Agent Tool Cache Registry

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-139 |
| Title | 2-Level Agent Tool Cache Registry — KB-based tool discovery cache |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-23 |
| Status | Draft |
| Related STP | STP-v1-KSA-139.docx |
| Related FSD | FSD-v1-KSA-139.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-23 | QA Agent | Initiate document — auto-generated from FSD use cases and business rules |

---

## Test Case Summary

| Category | ID Range | Count | Priority |
|----------|----------|-------|----------|
| PBT — Property-Based Tests | PBT-01 to PBT-06 | 6 | High |
| UT — Unit Tests (Happy Path) | UT-01 to UT-12 | 12 | High |
| UT — Unit Tests (Edge Cases) | UT-13 to UT-24 | 12 | High |
| IT — Integration Tests | IT-01 to IT-12 | 12 | High |
| E2E-API — End-to-End API Tests | E2E-API-01 to E2E-API-10 | 10 | High |
| SIT — Manual Exploratory | SIT-01 to SIT-05 | 5 | Medium |

**Total: 57 test cases (52 automated, 5 manual)**

---

## 1. Property-Based Tests (PBT)

### PBT-01: Lookup cascade always returns L2 before L1

| Field | Value |
|-------|-------|
| **ID** | PBT-01 |
| **Priority** | High |
| **Type** | Automated (pytest + hypothesis) |
| **Requirement** | BR-01, BR-02 |
| **File** | tests/cache/test_lookup_properties.py |

**Property:** For any tool_name that exists in both L2 and L1, `cache_lookup(query, agent)` always returns source=l2_cache.

**Strategy:**
```python
@given(tool_name=st.from_regex(r'[a-z_]{3,20}', fullmatch=True),
       agent_name=st.sampled_from(['ba-agent','sa-agent','qa-agent','dev-agent']))
def test_l2_always_before_l1(tool_name, agent_name):
    # Seed both L1 and L2 with same tool
    # Assert lookup returns source=l2_cache
```

---

### PBT-02: Error classification is deterministic

| Field | Value |
|-------|-------|
| **ID** | PBT-02 |
| **Priority** | High |
| **Type** | Automated (pytest + hypothesis) |
| **Requirement** | BR-11, BR-12 |
| **File** | tests/cache/test_classifier_properties.py |

**Property:** For any error message, `classify_error(msg)` always returns the same classification (permanent or transient) — no randomness.

**Strategy:**
```python
@given(error_msg=st.text(min_size=1, max_size=200))
def test_classification_deterministic(error_msg):
    result1 = classify_error(error_msg)
    result2 = classify_error(error_msg)
    assert result1 == result2
```

---

### PBT-03: Hit count is monotonically non-decreasing

| Field | Value |
|-------|-------|
| **ID** | PBT-03 |
| **Priority** | High |
| **Type** | Automated (pytest + hypothesis) |
| **Requirement** | BR-08, BR-16 |
| **File** | tests/cache/test_writer_properties.py |

**Property:** For any sequence of successful executions, hit count never decreases.

**Strategy:**
```python
@given(execution_count=st.integers(min_value=1, max_value=50))
def test_hits_monotonic(execution_count):
    # Execute tool N times, verify hits == N after each
```

---

### PBT-04: Dedup title format is unique per scope+tool

| Field | Value |
|-------|-------|
| **ID** | PBT-04 |
| **Priority** | High |
| **Type** | Automated (pytest + hypothesis) |
| **Requirement** | BR-10 |
| **File** | tests/cache/test_models_properties.py |

**Property:** Two ToolCacheEntry objects with same (scope, tool_name) always produce the same title. Different (scope, tool_name) always produce different titles.

---

### PBT-05: Injection count respects configured N

| Field | Value |
|-------|-------|
| **ID** | PBT-05 |
| **Priority** | Medium |
| **Type** | Automated (pytest + hypothesis) |
| **Requirement** | BR-15, BR-21 |
| **File** | tests/cache/test_injector_properties.py |

**Property:** For any N in [0,20] and any number of cached tools, `get_injection(agent, N)` returns at most N tools.

---

### PBT-06: Cache entry serialization roundtrip

| Field | Value |
|-------|-------|
| **ID** | PBT-06 |
| **Priority** | Medium |
| **Type** | Automated (pytest + hypothesis) |
| **Requirement** | BR-03, BR-19 |
| **File** | tests/cache/test_models_properties.py |

**Property:** For any valid ToolCacheEntry, `from_kb_content(entry.to_kb_content())` produces an equivalent entry.

---

## 2. Unit Tests (UT) — Core Logic

### UT-01: L2 cache hit returns tool immediately

| Field | Value |
|-------|-------|
| **ID** | UT-01 |
| **Priority** | High |
| **Type** | Automated (pytest + pytest-asyncio) |
| **Requirement** | UC-01 Main Flow Step 2-3, BR-01, BR-02 |
| **Preconditions** | KB has tool entry with tags `tool-cache, agent:ba-agent` |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Seed KB with tool "jira_search" in agent:ba-agent scope | Entry exists in KB |
| 2 | Call `cache_lookup("search jira", "ba-agent")` | Returns ToolCacheEntry with source=l2_cache |
| 3 | Verify find_tools was NOT called | No delegation to discovery |

**Test Data:** tool_name="jira_search", server_name="atlassian", agent="ba-agent"
**Postconditions:** KB state unchanged

---

### UT-02: L1 cache hit when L2 misses

| Field | Value |
|-------|-------|
| **ID** | UT-02 |
| **Priority** | High |
| **Type** | Automated (pytest + pytest-asyncio) |
| **Requirement** | UC-01 Main Flow Step 4-5, BR-01 |
| **Preconditions** | KB has tool in global scope only, no agent-specific entry |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Seed KB with tool "kb_search" in scope:global only | Entry exists in L1 |
| 2 | Call `cache_lookup("search knowledge base", "qa-agent")` | Returns ToolCacheEntry with source=l1_cache |
| 3 | Verify L2 was searched first (no result) | L2 search executed before L1 |

**Test Data:** tool_name="kb_search", server_name="kb-server", scope="global"
**Postconditions:** KB state unchanged

---

### UT-03: Full cache miss delegates to find_tools

| Field | Value |
|-------|-------|
| **ID** | UT-03 |
| **Priority** | High |
| **Type** | Automated (pytest + pytest-asyncio) |
| **Requirement** | UC-01 Main Flow Step 6-7, BR-02 |
| **Preconditions** | KB has no matching entries for query |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure KB is empty (no tool-cache entries) | No cache entries |
| 2 | Call `cache_lookup("deploy to production", "devops-agent")` | Returns None (cache miss) |
| 3 | Verify caller falls back to find_tools | find_tools called with original query |

**Test Data:** query="deploy to production", agent="devops-agent"
**Postconditions:** KB state unchanged

---

### UT-04: Auto-ingest newly discovered tool into L1 + L2

| Field | Value |
|-------|-------|
| **ID** | UT-04 |
| **Priority** | High |
| **Type** | Automated (pytest + pytest-asyncio) |
| **Requirement** | UC-02 Main Flow Step 3, BR-06 |
| **Preconditions** | Tool was discovered via find_tools (source=discovered) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `on_success(tool="jira_create", server="atlassian", agent="ba-agent", source="discovered")` | Function completes |
| 2 | Search KB for title "tool-cache:global:jira_create" | L1 entry exists with hits=1 |
| 3 | Search KB for title "tool-cache:agent:ba-agent:jira_create" | L2 entry exists with hits=1 |

**Test Data:** tool_name="jira_create", server_name="atlassian", input_schema={"type":"object"}
**Postconditions:** Both L1 and L2 entries created

---

### UT-05: Auto-ingest L1 tool into L2 only

| Field | Value |
|-------|-------|
| **ID** | UT-05 |
| **Priority** | High |
| **Type** | Automated (pytest + pytest-asyncio) |
| **Requirement** | UC-02 Main Flow Step 4, BR-07 |
| **Preconditions** | Tool found from L1 cache (source=l1_cache) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Seed L1 with tool "code_search" (hits=5) | L1 entry exists |
| 2 | Call `on_success(tool="code_search", agent="dev-agent", source="l1_cache")` | Function completes |
| 3 | Search KB for L2 entry | L2 entry "tool-cache:agent:dev-agent:code_search" created |
| 4 | Verify L1 hits incremented | L1 entry hits=6 |

**Test Data:** tool_name="code_search", server_name="code-intel"
**Postconditions:** L2 created, L1 hits incremented

---

### UT-06: L2 hit increments hit count only

| Field | Value |
|-------|-------|
| **ID** | UT-06 |
| **Priority** | High |
| **Type** | Automated (pytest + pytest-asyncio) |
| **Requirement** | UC-02 Main Flow Step 5, BR-08 |
| **Preconditions** | Tool found from L2 cache (source=l2_cache) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Seed L2 with tool "kb_ingest" (hits=10) | L2 entry exists |
| 2 | Call `on_success(tool="kb_ingest", agent="ba-agent", source="l2_cache")` | Function completes |
| 3 | Verify L2 hits incremented | L2 entry hits=11 |
| 4 | Verify no new entries created | Total KB entries unchanged |

**Test Data:** tool_name="kb_ingest", agent="ba-agent", initial_hits=10
**Postconditions:** Only hit count updated

---

### UT-07: Permanent error triggers invalidation

| Field | Value |
|-------|-------|
| **ID** | UT-07 |
| **Priority** | High |
| **Type** | Automated (pytest + pytest-asyncio) |
| **Requirement** | UC-03 Main Flow Step 2-4, BR-11 |
| **Preconditions** | Tool exists in both L1 and L2, execution fails with "tool not found" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Seed L1 and L2 with tool "old_tool" | Both entries exist |
| 2 | Call `on_failure(tool="old_tool", agent="ba-agent", error="ToolNotFoundError")` | Function completes |
| 3 | Search KB for L2 entry | Entry deleted |
| 4 | Search KB for L1 entry | Entry deleted |

**Test Data:** tool_name="old_tool", error_type="ToolNotFoundError"
**Postconditions:** Both L1 and L2 entries removed

---

### UT-08: Transient error does NOT invalidate

| Field | Value |
|-------|-------|
| **ID** | UT-08 |
| **Priority** | High |
| **Type** | Automated (pytest + pytest-asyncio) |
| **Requirement** | UC-03 AF-01, BR-12 |
| **Preconditions** | Tool exists in cache, execution fails with timeout |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Seed L2 with tool "slow_tool" (hits=5) | Entry exists |
| 2 | Call `on_failure(tool="slow_tool", agent="ba-agent", error="TimeoutError")` | Function completes |
| 3 | Search KB for L2 entry | Entry still exists with hits=5 |

**Test Data:** tool_name="slow_tool", error_type="TimeoutError"
**Postconditions:** Cache entry preserved

---

### UT-09: Server disconnect bulk invalidation

| Field | Value |
|-------|-------|
| **ID** | UT-09 |
| **Priority** | High |
| **Type** | Automated (pytest + pytest-asyncio) |
| **Requirement** | UC-03 AF-02, BR-13 |
| **Preconditions** | Multiple tools cached for server "atlassian" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Seed KB with 3 tools from server "atlassian" | 3 entries exist |
| 2 | Call `invalidate_server("atlassian")` | Function completes |
| 3 | Search KB for any tool-cache entries with server:atlassian | No entries found |

**Test Data:** server_name="atlassian", tools=["jira_search","jira_create","jira_update"]
**Postconditions:** All entries for server removed

---

### UT-10: Top-N injection ranked by hits

| Field | Value |
|-------|-------|
| **ID** | UT-10 |
| **Priority** | High |
| **Type** | Automated (pytest + pytest-asyncio) |
| **Requirement** | UC-04 Main Flow Step 2-3, BR-15, BR-16 |
| **Preconditions** | Agent has 8 cached tools with varying hit counts |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Seed L2 with 8 tools (hits: 20,15,12,10,8,5,3,1) | 8 entries exist |
| 2 | Call `get_injection("ba-agent", count=5)` | Returns 5 tools |
| 3 | Verify order is by hits DESC | Tools with hits 20,15,12,10,8 returned |

**Test Data:** 8 tools with hits=[20,15,12,10,8,5,3,1]
**Postconditions:** KB state unchanged

---

### UT-11: Injection supplements from L1 when L2 insufficient

| Field | Value |
|-------|-------|
| **ID** | UT-11 |
| **Priority** | Medium |
| **Type** | Automated (pytest + pytest-asyncio) |
| **Requirement** | UC-04 Main Flow Step 4, BR-17 |
| **Preconditions** | Agent has 2 L2 tools, L1 has 10 tools |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Seed L2 with 2 tools, L1 with 10 tools | Entries exist |
| 2 | Call `get_injection("new-agent", count=5)` | Returns 5 tools |
| 3 | Verify first 2 are from L2 | L2 tools have priority |
| 4 | Verify remaining 3 are from L1 | L1 supplements the gap |

**Test Data:** L2 tools=2, L1 tools=10, N=5
**Postconditions:** KB state unchanged

---

### UT-12: Config validation rejects invalid inject_count

| Field | Value |
|-------|-------|
| **ID** | UT-12 |
| **Priority** | Medium |
| **Type** | Automated (pytest) |
| **Requirement** | UC-05 Main Flow Step 2, BR-21 |
| **Preconditions** | Config file exists |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set inject_count = -1 | Validation rejects |
| 2 | Set inject_count = 21 | Validation rejects |
| 3 | Set inject_count = 0 | Accepted (disables injection) |
| 4 | Set inject_count = 20 | Accepted (max valid) |

**Test Data:** values=[-1, 21, 0, 20, 5, "abc", null]
**Postconditions:** Invalid values rejected, valid values accepted

---

## 3. Unit Tests (UT) — Edge Cases

### UT-13: KB unavailable during L2 lookup — graceful fallback

| Field | Value |
|-------|-------|
| **ID** | UT-13 |
| **Priority** | High |
| **Type** | Automated (pytest + pytest-asyncio) |
| **Requirement** | UC-01 AF-01, BR-05 |
| **Preconditions** | KB server is down/unreachable |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock KB to raise ConnectionError | KB unavailable |
| 2 | Call `cache_lookup("search jira", "ba-agent")` | Returns None (graceful degradation) |
| 3 | Verify no exception propagated to caller | Function returns cleanly |

**Test Data:** query="search jira", agent="ba-agent"
**Postconditions:** System continues to work via find_tools fallback

---

### UT-14: KB search timeout (>100ms) abandoned

| Field | Value |
|-------|-------|
| **ID** | UT-14 |
| **Priority** | High |
| **Type** | Automated (pytest + pytest-asyncio) |
| **Requirement** | UC-01 EF-02, BR-04 |
| **Preconditions** | KB search takes >100ms |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock KB search to sleep 150ms | Simulates slow KB |
| 2 | Call `cache_lookup("search", "ba-agent")` with 100ms timeout | Returns None after timeout |
| 3 | Verify warning logged | Log contains "[ToolCache] KB error during lookup" |

**Test Data:** timeout_ms=100, simulated_latency=150ms
**Postconditions:** Caller falls back to find_tools

---

### UT-15: Multiple tools match query — highest hit returned

| Field | Value |
|-------|-------|
| **ID** | UT-15 |
| **Priority** | Medium |
| **Type** | Automated (pytest + pytest-asyncio) |
| **Requirement** | UC-01 AF-02 |
| **Preconditions** | KB has multiple tools matching "search" query |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Seed L2 with "jira_search" (hits=20) and "kb_search" (hits=5) | Both match "search" |
| 2 | Call `cache_lookup("search", "ba-agent")` | Returns "jira_search" (highest hits) |

**Test Data:** tools=[("jira_search",20),("kb_search",5)]
**Postconditions:** Highest-hit tool returned

---

### UT-16: Dedup on ingest — same tool same scope

| Field | Value |
|-------|-------|
| **ID** | UT-16 |
| **Priority** | High |
| **Type** | Automated (pytest + pytest-asyncio) |
| **Requirement** | UC-02 AF-02, BR-10 |
| **Preconditions** | Tool already exists in KB with same title |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Seed L1 with "jira_search" (hits=5) | Entry exists |
| 2 | Call `on_success(tool="jira_search", source="discovered")` again | No duplicate created |
| 3 | Verify single entry with hits=6 | Hit count incremented, not duplicated |

**Test Data:** tool_name="jira_search", scope="global"
**Postconditions:** Single entry with updated hits

---

### UT-17: Ingest failure does not block execution response

| Field | Value |
|-------|-------|
| **ID** | UT-17 |
| **Priority** | High |
| **Type** | Automated (pytest + pytest-asyncio) |
| **Requirement** | UC-02 AF-01, BR-09 |
| **Preconditions** | KB ingest will fail (simulated) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock kb_ingest to raise Exception | Ingest will fail |
| 2 | Call `on_success(tool="new_tool", source="discovered")` | Function completes without raising |
| 3 | Verify error logged | Log contains "[ToolCache] KB error during ingest" |

**Test Data:** tool_name="new_tool"
**Postconditions:** Execution response not delayed

---

### UT-18: Invalidation of non-existent entry is no-op

| Field | Value |
|-------|-------|
| **ID** | UT-18 |
| **Priority** | Medium |
| **Type** | Automated (pytest + pytest-asyncio) |
| **Requirement** | UC-03 AF-03, BR-14 |
| **Preconditions** | Tool not in cache |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure no entry for "ghost_tool" in KB | No entry exists |
| 2 | Call `on_failure(tool="ghost_tool", agent="ba-agent", error="ToolNotFoundError")` | Function completes |
| 3 | Verify no exception | Best-effort, logged and continued |

**Test Data:** tool_name="ghost_tool"
**Postconditions:** No change to KB

---

### UT-19: Empty injection when no cached tools

| Field | Value |
|-------|-------|
| **ID** | UT-19 |
| **Priority** | Medium |
| **Type** | Automated (pytest + pytest-asyncio) |
| **Requirement** | UC-04 AF-01 |
| **Preconditions** | Agent has no cached tools, L1 also empty |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure KB has no tool-cache entries | Empty cache |
| 2 | Call `get_injection("new-agent", count=5)` | Returns empty string or None |
| 3 | Verify sub-agent prompt is not modified | No injection prepended |

**Test Data:** agent="new-agent", N=5
**Postconditions:** Agent uses find_tools normally

---

### UT-20: Zero injection count disables feature

| Field | Value |
|-------|-------|
| **ID** | UT-20 |
| **Priority** | Low |
| **Type** | Automated (pytest) |
| **Requirement** | UC-05, BR-21 |
| **Preconditions** | Config has inject_count=0 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set config inject_count=0 | Config applied |
| 2 | Call `get_injection("ba-agent")` | Returns empty (injection disabled) |
| 3 | Verify no KB query made | Skip injection entirely |

**Test Data:** inject_count=0
**Postconditions:** No tools injected

---

### UT-21: Error classifier — all permanent error types

| Field | Value |
|-------|-------|
| **ID** | UT-21 |
| **Priority** | High |
| **Type** | Automated (pytest) |
| **Requirement** | FSD 3.3.4, BR-11 |
| **Preconditions** | None |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Classify "ToolNotFoundError" | Returns PERMANENT |
| 2 | Classify "SchemaMismatchError" | Returns PERMANENT |
| 3 | Classify "PermissionDeniedError" | Returns PERMANENT |

**Test Data:** errors=["ToolNotFoundError","SchemaMismatchError","PermissionDeniedError"]
**Postconditions:** All classified as permanent

---

### UT-22: Error classifier — all transient error types

| Field | Value |
|-------|-------|
| **ID** | UT-22 |
| **Priority** | High |
| **Type** | Automated (pytest) |
| **Requirement** | FSD 3.3.4, BR-12 |
| **Preconditions** | None |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Classify "TimeoutError" | Returns TRANSIENT |
| 2 | Classify "ConnectionRefusedError" | Returns TRANSIENT |
| 3 | Classify "RateLimitError" | Returns TRANSIENT |

**Test Data:** errors=["TimeoutError","ConnectionRefusedError","RateLimitError"]
**Postconditions:** All classified as transient

---

### UT-23: Config hot-reload detects file change

| Field | Value |
|-------|-------|
| **ID** | UT-23 |
| **Priority** | Medium |
| **Type** | Automated (pytest) |
| **Requirement** | UC-05, BR-22 |
| **Preconditions** | Config file exists with inject_count=5 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Read config → inject_count=5 | Returns 5 |
| 2 | Modify file to inject_count=10, update mtime | File changed |
| 3 | Read config again | Returns 10 (hot-reloaded) |

**Test Data:** initial=5, updated=10
**Postconditions:** New config value active

---

### UT-24: Cache entry title format correctness

| Field | Value |
|-------|-------|
| **ID** | UT-24 |
| **Priority** | Medium |
| **Type** | Automated (pytest) |
| **Requirement** | BR-10, FSD 3.1.4 |
| **Preconditions** | None |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create entry with scope="global", tool="jira_search" | title="tool-cache:global:jira_search" |
| 2 | Create entry with scope="agent:ba-agent", tool="kb_search" | title="tool-cache:agent:ba-agent:kb_search" |
| 3 | Verify tags format | Global: "tool-cache, scope:global, server:{name}" |

**Test Data:** Various scope/tool combinations
**Postconditions:** Title format matches FSD specification

---

## 4. Integration Tests (IT)

### IT-01: Full lookup cascade with real KB — L2 hit

| Field | Value |
|-------|-------|
| **ID** | IT-01 |
| **Priority** | High |
| **Type** | Automated (pytest + pytest-asyncio + SQLite KB) |
| **Requirement** | UC-01, BR-01, BR-02, BR-03 |
| **Preconditions** | Real SQLite KB running, seeded with test data |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start KB server with SQLite backend | KB available |
| 2 | Ingest tool "jira_search" into L2 (agent:ba-agent) via kb_ingest | Entry persisted |
| 3 | Call cache_lookup("search jira issues", "ba-agent") | Returns tool with source=l2_cache |
| 4 | Verify returned entry has complete metadata | tool_name, server_name, input_schema all present |

**Test Data:** Real KB entry with full schema
**Postconditions:** KB entry unchanged

---

### IT-02: Full lookup cascade with real KB — L1 hit after L2 miss

| Field | Value |
|-------|-------|
| **ID** | IT-02 |
| **Priority** | High |
| **Type** | Automated (pytest + pytest-asyncio + SQLite KB) |
| **Requirement** | UC-01, BR-01 |
| **Preconditions** | Real KB with tool in global scope only |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ingest tool "code_analyze" into L1 (scope:global) only | L1 entry exists |
| 2 | Call cache_lookup("analyze code", "qa-agent") | Returns tool with source=l1_cache |
| 3 | Verify L2 was searched first (no result) then L1 hit | Cascade order correct |

**Test Data:** tool in global scope, query from qa-agent
**Postconditions:** KB entry unchanged

---

### IT-03: Full cascade miss → find_tools → auto-ingest

| Field | Value |
|-------|-------|
| **ID** | IT-03 |
| **Priority** | High |
| **Type** | Automated (pytest + pytest-asyncio + SQLite KB) |
| **Requirement** | UC-01, UC-02, BR-06 |
| **Preconditions** | Empty KB, mock MCP server with tool available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure KB has no tool-cache entries | Empty cache |
| 2 | Call find_tools_handler("create jira issue", "ba-agent") | Discovers tool from mock server |
| 3 | Simulate successful execution | on_success triggered |
| 4 | Verify L1 entry created | "tool-cache:global:jira_create" in KB |
| 5 | Verify L2 entry created | "tool-cache:agent:ba-agent:jira_create" in KB |

**Test Data:** Mock MCP server returns jira_create tool
**Postconditions:** Both L1 and L2 populated

---

### IT-04: Invalidation flow — execute fail → delete → re-discover

| Field | Value |
|-------|-------|
| **ID** | IT-04 |
| **Priority** | High |
| **Type** | Automated (pytest + pytest-asyncio + SQLite KB) |
| **Requirement** | UC-03, BR-11 |
| **Preconditions** | Tool cached in KB, tool removed from MCP server |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Seed KB with "old_tool" in L1 and L2 | Entries exist |
| 2 | Execute "old_tool" → fails with ToolNotFoundError | Execution fails |
| 3 | Verify invalidation triggered | Both L1 and L2 entries deleted |
| 4 | Next lookup for same query | Falls through to find_tools |

**Test Data:** tool_name="old_tool", error="ToolNotFoundError"
**Postconditions:** Cache cleared, ready for re-discovery

---

### IT-05: Injection flow — populate → query top-N

| Field | Value |
|-------|-------|
| **ID** | IT-05 |
| **Priority** | High |
| **Type** | Automated (pytest + pytest-asyncio + SQLite KB) |
| **Requirement** | UC-04, BR-15, BR-16 |
| **Preconditions** | Real KB with multiple cached tools |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ingest 8 tools for "ba-agent" with varying hits | 8 L2 entries |
| 2 | Call get_injection("ba-agent", count=5) | Returns JSON with 5 tools |
| 3 | Verify tools are ordered by hits DESC | Highest-hit tools first |
| 4 | Verify JSON format is compact and complete | Contains tool_name, server_name, input_schema |

**Test Data:** 8 tools with hits=[25,20,15,12,10,8,5,2]
**Postconditions:** KB unchanged

---

### IT-06: Persistence across simulated restart

| Field | Value |
|-------|-------|
| **ID** | IT-06 |
| **Priority** | High |
| **Type** | Automated (pytest + pytest-asyncio + SQLite KB) |
| **Requirement** | Story 7, AC6 |
| **Preconditions** | SQLite KB file on disk |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ingest 3 tools into KB | Entries persisted to SQLite |
| 2 | Close KB connection (simulate restart) | Connection closed |
| 3 | Reopen KB connection | New connection |
| 4 | Query for cached tools | All 3 entries found with correct hit counts |

**Test Data:** 3 tools with hits=[10,5,3]
**Postconditions:** Data survives restart

---

### IT-07: Concurrent cache writes — no data corruption

| Field | Value |
|-------|-------|
| **ID** | IT-07 |
| **Priority** | High |
| **Type** | Automated (pytest + pytest-asyncio + SQLite KB) |
| **Requirement** | BR-09, TDD 8.1 |
| **Preconditions** | Real KB, multiple async tasks |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Launch 10 concurrent on_success calls for different tools | 10 async tasks |
| 2 | Await all tasks | All complete without error |
| 3 | Verify all 10 entries exist in KB | No lost writes |
| 4 | Verify no duplicate entries | Dedup by title works under concurrency |

**Test Data:** 10 different tools, concurrent execution
**Postconditions:** All entries correctly persisted

---

### IT-08: Hit count increment under concurrent access

| Field | Value |
|-------|-------|
| **ID** | IT-08 |
| **Priority** | Medium |
| **Type** | Automated (pytest + pytest-asyncio + SQLite KB) |
| **Requirement** | BR-08, BR-16 |
| **Preconditions** | Tool exists in L2 with hits=0 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Seed L2 with "popular_tool" (hits=0) | Entry exists |
| 2 | Launch 20 concurrent on_success calls (source=l2_cache) | 20 async tasks |
| 3 | Await all tasks | All complete |
| 4 | Verify hits=20 | All increments applied |

**Test Data:** tool="popular_tool", concurrent_calls=20
**Postconditions:** hits=20 (no lost increments)

---

### IT-09: KB integration — tag-based filtering accuracy

| Field | Value |
|-------|-------|
| **ID** | IT-09 |
| **Priority** | High |
| **Type** | Automated (pytest + pytest-asyncio + SQLite KB) |
| **Requirement** | FSD 3.1.4, BR-01 |
| **Preconditions** | KB has tools for multiple agents and global scope |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ingest "tool_a" for agent:ba-agent | L2 entry |
| 2 | Ingest "tool_b" for agent:sa-agent | L2 entry |
| 3 | Ingest "tool_c" for scope:global | L1 entry |
| 4 | Search with tags "tool-cache, agent:ba-agent" | Returns only tool_a |
| 5 | Search with tags "tool-cache, scope:global" | Returns only tool_c |

**Test Data:** 3 tools in different scopes
**Postconditions:** Tag filtering isolates scopes correctly

---

### IT-10: Config hot-reload with real file system

| Field | Value |
|-------|-------|
| **ID** | IT-10 |
| **Priority** | Medium |
| **Type** | Automated (pytest) |
| **Requirement** | UC-05, BR-22, BR-23 |
| **Preconditions** | orchestration.json exists with tool_cache section |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Write orchestration.json with inject_count=5 | File on disk |
| 2 | Read config → verify inject_count=5 | Correct value |
| 3 | Modify file to inject_count=8 | File updated |
| 4 | Wait for mtime change detection | Config reloaded |
| 5 | Read config → verify inject_count=8 | New value active |

**Test Data:** Config file with tool_cache section
**Postconditions:** Hot-reload works without restart

---

### IT-11: Injection deduplication — L2 tools not repeated from L1

| Field | Value |
|-------|-------|
| **ID** | IT-11 |
| **Priority** | Medium |
| **Type** | Automated (pytest + pytest-asyncio + SQLite KB) |
| **Requirement** | UC-04 Main Flow Step 5, BR-17 |
| **Preconditions** | Same tool exists in both L2 and L1 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ingest "shared_tool" in both L2 (ba-agent) and L1 | Both entries exist |
| 2 | Ingest 1 more L2 tool (total L2=2) | 2 L2 entries |
| 3 | Call get_injection("ba-agent", count=5) with L1 supplement | Returns 5 unique tools |
| 4 | Verify "shared_tool" appears only once (from L2) | No duplicates |

**Test Data:** shared_tool in both scopes, N=5
**Postconditions:** Deduplicated injection list

---

### IT-12: Full middleware integration — find_tools with cache layer

| Field | Value |
|-------|-------|
| **ID** | IT-12 |
| **Priority** | High |
| **Type** | Automated (pytest + pytest-asyncio + SQLite KB) |
| **Requirement** | TDD 5.1, UC-01 |
| **Preconditions** | Full cache middleware integrated with find_tools handler |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call find_tools_handler("search jira", "ba-agent") — first time | Discovers via mock server, returns tool |
| 2 | Verify tool auto-ingested into cache | L1 + L2 entries created |
| 3 | Call find_tools_handler("search jira", "ba-agent") — second time | Returns from L2 cache (no discovery) |
| 4 | Verify find_tools NOT called second time | Cache hit short-circuits |

**Test Data:** Mock MCP server with jira_search tool
**Postconditions:** Second call served from cache

---

## 5. E2E-API Tests

### E2E-API-01: Full tool discovery → cache → re-use lifecycle

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-01 |
| **Priority** | High |
| **Type** | Automated (pytest + httpx/MCP client) |
| **File** | tests/e2e/test_cache_lifecycle.py |
| **Traces To** | BRD Story 1 (AC1), Story 2 (AC2) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start full MCP server with cache middleware | Server running |
| 2 | Call find_tools("search jira issues") as ba-agent | Tool discovered from MCP server |
| 3 | Call execute_dynamic_tool("jira_search", {...}) | Execution succeeds |
| 4 | Call find_tools("search jira issues") as ba-agent again | Tool returned from L2 cache (faster) |
| 5 | Verify response includes source indicator | source=l2_cache |

**Test Data:** Real MCP server with atlassian tools
**Postconditions:** Tool cached and reusable

---

### E2E-API-02: Cache invalidation and re-discovery

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-02 |
| **Priority** | High |
| **Type** | Automated (pytest + httpx/MCP client) |
| **File** | tests/e2e/test_cache_invalidation.py |
| **Traces To** | BRD Story 3 (AC3) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Populate cache with "removable_tool" | Cached in L1+L2 |
| 2 | Remove tool from mock MCP server | Tool no longer available |
| 3 | Call execute_dynamic_tool("removable_tool", {...}) | Fails with ToolNotFoundError |
| 4 | Verify cache entries deleted | L1 and L2 entries gone |
| 5 | Re-add tool to mock server, call find_tools | Re-discovers and re-caches |

**Test Data:** Mock server with removable tool
**Postconditions:** Cache rebuilt after invalidation

---

### E2E-API-03: Startup injection into sub-agent prompt

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-03 |
| **Priority** | High |
| **Type** | Automated (pytest + httpx/MCP client) |
| **File** | tests/e2e/test_injection.py |
| **Traces To** | BRD Story 4 (AC4) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Populate cache with 8 tools for "ba-agent" | 8 L2 entries |
| 2 | Invoke sub-agent "ba-agent" via parent | Sub-agent invoked |
| 3 | Capture enriched prompt sent to sub-agent | Prompt contains cached_tools JSON |
| 4 | Verify top-5 tools by hits are injected | Correct tools in correct order |
| 5 | Verify injected tools have complete schemas | tool_name, server_name, input_schema present |

**Test Data:** 8 tools with varying hit counts
**Postconditions:** Sub-agent receives enriched prompt

---

### E2E-API-04: Transient error preserves cache

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-04 |
| **Priority** | High |
| **Type** | Automated (pytest + httpx/MCP client) |
| **File** | tests/e2e/test_transient_errors.py |
| **Traces To** | BRD Story 3 (AC3 — transient clause) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Populate cache with "slow_tool" | Cached |
| 2 | Mock server to return TimeoutError for "slow_tool" | Transient failure |
| 3 | Call execute_dynamic_tool("slow_tool", {...}) | Fails with timeout |
| 4 | Verify cache entry still exists | Entry preserved (not invalidated) |
| 5 | Mock server to succeed, retry execution | Succeeds using cached entry |

**Test Data:** tool with simulated timeout
**Postconditions:** Cache preserved through transient failures

---

### E2E-API-05: Cross-session persistence verification

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-05 |
| **Priority** | High |
| **Type** | Automated (pytest + httpx/MCP client) |
| **File** | tests/e2e/test_persistence.py |
| **Traces To** | BRD Story 7 (AC6) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start server, populate cache with 5 tools | 5 entries in SQLite |
| 2 | Stop server (graceful shutdown) | Server stopped |
| 3 | Restart server | Server running again |
| 4 | Call find_tools for previously cached tool | Returns from cache (not re-discovered) |
| 5 | Verify hit counts preserved | Same values as before restart |

**Test Data:** 5 tools with known hit counts
**Postconditions:** Cache survives restart

---

### E2E-API-06: Configuration change without restart

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-06 |
| **Priority** | Medium |
| **Type** | Automated (pytest + httpx/MCP client) |
| **File** | tests/e2e/test_config_hotreload.py |
| **Traces To** | BRD Story 6 (AC8), BR-22 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start server with inject_count=5 | Default config |
| 2 | Invoke sub-agent → verify 5 tools injected | 5 tools in prompt |
| 3 | Modify orchestration.json: inject_count=3 | Config file changed |
| 4 | Invoke sub-agent again → verify 3 tools injected | New config active |
| 5 | Verify no server restart was needed | Same process, hot-reloaded |

**Test Data:** Config changes: 5 → 3
**Postconditions:** Config change effective immediately

---

### E2E-API-07: Per-agent scope isolation

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-07 |
| **Priority** | High |
| **Type** | Automated (pytest + httpx/MCP client) |
| **File** | tests/e2e/test_scope_isolation.py |
| **Traces To** | BRD Story 8, BR-01 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | As ba-agent: discover and cache "jira_search" | Cached in L2:ba-agent + L1 |
| 2 | As sa-agent: lookup "jira_search" | Found in L1 (not L2:sa-agent) |
| 3 | As sa-agent: execute successfully | Cached in L2:sa-agent |
| 4 | Verify ba-agent L2 and sa-agent L2 are separate entries | Different titles |
| 5 | Invalidate ba-agent's entry | Only ba-agent L2 removed, sa-agent L2 intact |

**Test Data:** Two agents sharing a tool
**Postconditions:** Scope isolation maintained

---

### E2E-API-08: Hit-based ranking accuracy

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-08 |
| **Priority** | Medium |
| **Type** | Automated (pytest + httpx/MCP client) |
| **File** | tests/e2e/test_hit_ranking.py |
| **Traces To** | BRD Story 5 (AC5), BR-16 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Cache 5 tools with hits: A=1, B=5, C=3, D=10, E=7 | 5 entries |
| 2 | Call get_injection("ba-agent", count=3) | Returns 3 tools |
| 3 | Verify order: D(10), E(7), B(5) | Ranked by hits DESC |
| 4 | Execute tool A 15 times (hits→16) | A becomes most popular |
| 5 | Call get_injection again | A now first in list |

**Test Data:** 5 tools with varying hits
**Postconditions:** Ranking reflects actual usage

---

### E2E-API-09: Graceful degradation — KB unavailable

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-09 |
| **Priority** | High |
| **Type** | Automated (pytest + httpx/MCP client) |
| **File** | tests/e2e/test_graceful_degradation.py |
| **Traces To** | BR-05, FSD 8 (Availability) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start server with KB available, cache some tools | Normal operation |
| 2 | Simulate KB failure (stop SQLite access) | KB unavailable |
| 3 | Call find_tools("search jira") | Falls back to find_tools discovery (no crash) |
| 4 | Call execute_dynamic_tool successfully | Execution works, cache write silently fails |
| 5 | Restore KB access | Cache operations resume |

**Test Data:** Simulated KB failure
**Postconditions:** System fully functional without cache

---

### E2E-API-10: Server disconnect bulk invalidation

| Attribute | Value |
|-----------|-------|
| **ID** | E2E-API-10 |
| **Priority** | Medium |
| **Type** | Automated (pytest + httpx/MCP client) |
| **File** | tests/e2e/test_server_disconnect.py |
| **Traces To** | BR-13, UC-03 AF-02 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Cache 5 tools from server "atlassian" | 5 entries |
| 2 | Cache 3 tools from server "kb-server" | 3 entries |
| 3 | Simulate "atlassian" server disconnect | Server unavailable |
| 4 | Trigger invalidate_server("atlassian") | Bulk invalidation |
| 5 | Verify all 5 atlassian entries deleted | Gone from KB |
| 6 | Verify 3 kb-server entries still exist | Unaffected |

**Test Data:** Tools from 2 different servers
**Postconditions:** Only disconnected server's entries removed

---

## 6. Manual SIT Tests

### SIT-01: KB unavailable — observe graceful degradation behavior

| Field | Value |
|-------|-------|
| **ID** | SIT-01 |
| **Priority** | Medium |
| **Type** | Manual (exploratory) |
| **Requirement** | BR-05, FSD 9.1 |
| **Preconditions** | MCP server running, KB SQLite file accessible |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start MCP server normally, verify cache works | Cache hits visible in logs |
| 2 | Rename/lock SQLite DB file to simulate KB failure | KB inaccessible |
| 3 | Trigger tool discovery via agent | find_tools works normally (no crash) |
| 4 | Observe log output | WARNING level: "[ToolCache] KB error during lookup" |
| 5 | Restore SQLite file | Cache operations resume automatically |

**Test Data:** Manual file manipulation
**Postconditions:** System recovers without restart

---

### SIT-02: Performance — verify KB lookup latency < 100ms

| Field | Value |
|-------|-------|
| **ID** | SIT-02 |
| **Priority** | High |
| **Type** | Manual (performance measurement) |
| **Requirement** | BR-04, FSD 8 |
| **Preconditions** | KB populated with 100+ entries (realistic load) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Seed KB with 100 tool-cache entries | Realistic data volume |
| 2 | Run 50 sequential cache lookups with timing | Measure each lookup |
| 3 | Calculate p50, p95, p99 latencies | p95 < 100ms |
| 4 | Run 10 concurrent lookups | No degradation under load |
| 5 | Verify no lookup exceeds 100ms timeout | All within SLA |

**Test Data:** 100 seeded entries, 50 queries
**Postconditions:** Performance validated

---

### SIT-03: Log output quality and observability

| Field | Value |
|-------|-------|
| **ID** | SIT-03 |
| **Priority** | Low |
| **Type** | Manual (observability review) |
| **Requirement** | FSD 9.2 |
| **Preconditions** | Server running with DEBUG logging |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger L2 cache hit | Log: "[ToolCache] L2 hit: {tool} for {agent} (hits={n})" |
| 2 | Trigger L1 cache hit | Log: "[ToolCache] L1 hit: {tool} for {agent} (hits={n})" |
| 3 | Trigger cache miss | Log: "[ToolCache] Miss: query="{q}" for {agent}" |
| 4 | Trigger invalidation | Log: "[ToolCache] Invalidated: {tool} reason={type}" |
| 5 | Trigger injection | Log: "[ToolCache] Injected {n} tools for {agent}" |

**Test Data:** Various operations to trigger all log events
**Postconditions:** All log formats match FSD specification

---

### SIT-04: Token savings measurement — before vs after cache

| Field | Value |
|-------|-------|
| **ID** | SIT-04 |
| **Priority** | Medium |
| **Type** | Manual (measurement) |
| **Requirement** | BRD 1.1 (~10,000 token savings) |
| **Preconditions** | Full SM pipeline available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run SM pipeline WITHOUT cache (disabled) | Count find_tools calls and tokens |
| 2 | Run SM pipeline WITH cache (enabled, warm) | Count find_tools calls and tokens |
| 3 | Compare token usage | ≥ 70% reduction in discovery tokens |
| 4 | Compare find_tools call count | ≥ 75% reduction |

**Test Data:** Same ticket processed with/without cache
**Postconditions:** Token savings quantified

---

### SIT-05: Injection format — verify compact JSON minimizes tokens

| Field | Value |
|-------|-------|
| **ID** | SIT-05 |
| **Priority** | Low |
| **Type** | Manual (format review) |
| **Requirement** | BR-18, FSD 3.4.4 |
| **Preconditions** | Injection engine working |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Generate injection for agent with 5 tools | JSON output |
| 2 | Count tokens in injection payload | ~200-400 tokens for 5 tools |
| 3 | Compare with 5 find_tools calls + responses | ~2500 tokens saved |
| 4 | Verify JSON is valid and parseable | Valid JSON structure |
| 5 | Verify all fields present for direct execution | tool_name, server_name, input_schema |

**Test Data:** 5 cached tools with full schemas
**Postconditions:** Format validated

---

## 7. Requirements Traceability Matrix (RTM)

### Use Cases Coverage

| Requirement | Source | Test Cases | Coverage |
|-------------|--------|------------|----------|
| UC-01 (Lookup Cascade) | FSD 3.1 | PBT-01, UT-01, UT-02, UT-03, UT-13, UT-14, UT-15, IT-01, IT-02, IT-03, IT-12, E2E-API-01 | ✅ |
| UC-02 (Auto Population) | FSD 3.2 | PBT-03, PBT-04, UT-04, UT-05, UT-06, UT-16, UT-17, IT-03, IT-07, IT-08, E2E-API-01 | ✅ |
| UC-03 (Invalidation) | FSD 3.3 | PBT-02, UT-07, UT-08, UT-09, UT-18, UT-21, UT-22, IT-04, E2E-API-02, E2E-API-04, E2E-API-10 | ✅ |
| UC-04 (Startup Injection) | FSD 3.4 | PBT-05, UT-10, UT-11, UT-19, UT-20, IT-05, IT-11, E2E-API-03, E2E-API-08 | ✅ |
| UC-05 (Configuration) | FSD 3.5 | UT-12, UT-20, UT-23, IT-10, E2E-API-06 | ✅ |

### Business Rules Coverage

| Requirement | Source | Test Cases | Coverage |
|-------------|--------|------------|----------|
| BR-01 (L2 before L1) | FSD 3.1.3 | PBT-01, UT-01, UT-02, IT-01, IT-02, IT-09, E2E-API-07 | ✅ |
| BR-02 (First hit short-circuits) | FSD 3.1.3 | PBT-01, UT-01, IT-12, E2E-API-01 | ✅ |
| BR-03 (Complete metadata) | FSD 3.1.3 | PBT-06, UT-01, IT-01, E2E-API-01 | ✅ |
| BR-04 (100ms timeout) | FSD 3.1.3 | UT-14, SIT-02 | ✅ |
| BR-05 (Graceful degradation) | FSD 3.1.3 | UT-13, E2E-API-09, SIT-01 | ✅ |
| BR-06 (New tool → L1+L2) | FSD 3.2.3 | UT-04, IT-03, E2E-API-01 | ✅ |
| BR-07 (L1 tool → L2 only) | FSD 3.2.3 | UT-05, IT-02 | ✅ |
| BR-08 (L2 hit → increment only) | FSD 3.2.3 | PBT-03, UT-06, IT-08 | ✅ |
| BR-09 (Async non-blocking) | FSD 3.2.3 | UT-17, IT-07 | ✅ |
| BR-10 (Dedup by title) | FSD 3.2.3 | PBT-04, UT-16, UT-24, IT-07 | ✅ |
| BR-11 (Permanent → invalidate) | FSD 3.3.3 | PBT-02, UT-07, UT-21, IT-04, E2E-API-02 | ✅ |
| BR-12 (Transient → keep) | FSD 3.3.3 | UT-08, UT-22, E2E-API-04 | ✅ |
| BR-13 (Server disconnect → bulk) | FSD 3.3.3 | UT-09, E2E-API-10 | ✅ |
| BR-14 (Best-effort invalidation) | FSD 3.3.3 | UT-18 | ✅ |
| BR-15 (Default N=5) | FSD 3.4.3 | PBT-05, UT-10, IT-05, E2E-API-03 | ✅ |
| BR-16 (Ranked by hits DESC) | FSD 3.4.3 | PBT-03, UT-10, IT-05, E2E-API-08 | ✅ |
| BR-17 (L2 priority over L1) | FSD 3.4.3 | UT-11, IT-11, E2E-API-03 | ✅ |
| BR-18 (Compact format) | FSD 3.4.3 | SIT-05 | ✅ |
| BR-19 (Sufficient for execution) | FSD 3.4.3 | PBT-06, E2E-API-03 | ✅ |
| BR-20 (Default inject_count=5) | FSD 3.5.3 | UT-12, E2E-API-06 | ✅ |
| BR-21 (Range 0-20) | FSD 3.5.3 | PBT-05, UT-12, UT-20 | ✅ |
| BR-22 (Hot-reloadable) | FSD 3.5.3 | UT-23, IT-10, E2E-API-06 | ✅ |
| BR-23 (Stored in orchestration.json) | FSD 3.5.3 | IT-10, E2E-API-06 | ✅ |

### Acceptance Criteria Coverage

| Requirement | Source | Test Cases | Coverage |
|-------------|--------|------------|----------|
| AC1 (KB lookup before find_tools) | BRD Story 1 | UT-01, UT-02, IT-01, IT-12, E2E-API-01 | ✅ |
| AC2 (Auto-ingest on success) | BRD Story 2 | UT-04, UT-05, UT-06, IT-03, E2E-API-01 | ✅ |
| AC3 (Auto-delete on failure) | BRD Story 3 | UT-07, UT-08, IT-04, E2E-API-02, E2E-API-04 | ✅ |
| AC4 (Startup injection top-N) | BRD Story 4 | UT-10, UT-11, IT-05, E2E-API-03 | ✅ |
| AC5 (Hit scoring/ranking) | BRD Story 5 | PBT-03, UT-10, IT-05, E2E-API-08 | ✅ |
| AC6 (Cross-session persistence) | BRD Story 7 | IT-06, E2E-API-05 | ✅ |
| AC7 (Per-agent scope isolation) | BRD Story 8 | IT-09, E2E-API-07 | ✅ |
| AC8 (Config N configurable) | BRD Story 6 | UT-12, UT-23, IT-10, E2E-API-06 | ✅ |

### Coverage Summary

| Category | Total | Covered | Coverage % |
|----------|-------|---------|------------|
| Use Cases | 5 | 5 | 100% |
| Business Rules | 23 | 23 | 100% |
| Acceptance Criteria | 8 | 8 | 100% |
| Error Classifications | 7 | 7 | 100% |
| **Overall** | **43** | **43** | **100%** |

---

## 8. Appendix

### Test Data Setup

```python
# fixtures/cache_fixtures.py
import pytest
from orchestration.cache.models import ToolCacheEntry

@pytest.fixture
def sample_tool_entry():
    return ToolCacheEntry(
        tool_name="jira_search",
        server_name="atlassian",
        description="Search Jira issues using JQL",
        input_schema={"type": "object", "required": ["jql"], "properties": {"jql": {"type": "string"}}},
        scope="global",
        hits=10,
        last_used="2026-05-23T10:00:00Z"
    )

@pytest.fixture
def agent_tools():
    """8 tools for ba-agent with varying hit counts."""
    tools = []
    for i, (name, hits) in enumerate([
        ("jira_search", 25), ("kb_search", 20), ("kb_ingest", 15),
        ("jira_create", 12), ("jira_update", 10), ("code_search", 8),
        ("file_read", 5), ("file_write", 2)
    ]):
        tools.append(ToolCacheEntry(
            tool_name=name, server_name="atlassian" if "jira" in name else "code-intel",
            description=f"Tool {name}", input_schema={"type": "object"},
            scope="agent:ba-agent", hits=hits, last_used=f"2026-05-{23-i}T10:00:00Z"
        ))
    return tools
```

### Error Classification Reference

| Error Type | Classification | Test Case |
|------------|---------------|-----------|
| ToolNotFoundError | Permanent | UT-21 |
| SchemaMismatchError | Permanent | UT-21 |
| PermissionDeniedError | Permanent | UT-21 |
| TimeoutError | Transient | UT-22 |
| ConnectionRefusedError | Transient | UT-22 |
| RateLimitError | Transient | UT-22 |
| ServerDisconnectedError | Server-level | UT-09 |

### Environment Configuration

```json
{
  "settings": {
    "tool_cache": {
      "enabled": true,
      "inject_count": 5,
      "lookup_timeout_ms": 100,
      "max_entries_per_scope": 100
    }
  }
}
```
