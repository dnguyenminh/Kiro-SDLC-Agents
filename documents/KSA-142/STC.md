# Software Test Cases (STC)

## MCP Code Intelligence — KSA-142: Feature Parity Sync

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-142 |
| Title | Feature Parity Sync — Đồng bộ 3 MCP Implementations (Python, Node.js, Kotlin) |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-07-25 |
| Status | Draft |
| Related STP | STP-v1-KSA-142.docx |
| Related FSD | FSD-v1-KSA-142.docx |
| Related TDD | TDD-v1-KSA-142.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-25 | QA Agent | Initiate document — auto-generated from FSD use cases and business rules |

---

## Test Case Summary

| Category | ID Range | Count | Priority |
|----------|----------|-------|----------|
| Functional — Happy Path | TC-001 to TC-012 | 12 | High |
| Functional — Alternative Flows | TC-100 to TC-112 | 13 | High |
| Functional — Exception/Error Flows | TC-200 to TC-211 | 12 | High |
| Business Rule Validation | TC-300 to TC-318 | 19 | High |
| Boundary & Negative Testing | TC-400 to TC-410 | 11 | Medium |
| Non-Functional (Performance) | TC-600 to TC-606 | 7 | Medium |
| Integration Testing | TC-700 to TC-705 | 6 | High |
| Parity Testing | TC-800 to TC-805 | 6 | Critical |

**Total: 86 test cases**

---

## 1. Functional Test Cases — Happy Path

### TC-001: Pin Entry to Core Memory — Happy Path

| Field | Value |
|-------|-------|
| **ID** | TC-001 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-01, BR-01, BR-02, Story 1 AC-1 |
| **Preconditions** | MCP server running (Python/Kotlin), knowledge entry ID=42 exists in DB, no entries currently pinned |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_pin(action="pin", entry_id=42)` | Response: success=true, entry pinned at position 1 |
| 2 | Call `mem_pin(action="list")` | Response includes entry_id=42 at position=1 with token_count > 0 |
| 3 | Call `mem_pin(action="get_context")` | Context string contains entry 42's summary |

**Test Data:** entry_id=42, entry summary="Architecture decision: use SQLite for all implementations" (approx 15 tokens)
**Postconditions:** Entry 42 is pinned at position 1, budget reduced by entry's token count

---

### TC-002: Auto-Recall Pinned Context — Happy Path

| Field | Value |
|-------|-------|
| **ID** | TC-002 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-02, BR-04, BR-05, Story 1 AC-3 |
| **Preconditions** | 3 entries pinned (IDs: 10, 20, 30) at positions 1, 2, 3 respectively |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_pin(action="get_context")` | Context string returned with all 3 entries in order (pos 1, 2, 3) |
| 2 | Verify token_count in response | token_count = sum of all 3 entry token counts |
| 3 | Verify budget_remaining | budget_remaining = 2000 - token_count |
| 4 | Verify entries_count | entries_count = 3 |

**Test Data:** Entry 10 summary (100 tokens), Entry 20 summary (150 tokens), Entry 30 summary (200 tokens)
**Postconditions:** No state change (read-only operation)

---

### TC-003: Unpin Entry from Core Memory

| Field | Value |
|-------|-------|
| **ID** | TC-003 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-01, BR-02, BR-03, Story 1 AC-4 |
| **Preconditions** | Entry 42 is pinned at position 2, entries at positions 1 and 3 also exist |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_pin(action="unpin", entry_id=42)` | Response: success=true, entry unpinned |
| 2 | Call `mem_pin(action="list")` | Entry 42 not in list, remaining entries re-ordered (positions 1, 2) |
| 3 | Call `mem_pin(action="get_context")` | Context does not contain entry 42's summary |

**Test Data:** entry_id=42
**Postconditions:** Entry 42 removed from pinned list, positions of remaining entries adjusted

---

### TC-004: Reorder Pinned Entries

| Field | Value |
|-------|-------|
| **ID** | TC-004 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | UC-01, BR-03, Story 1 |
| **Preconditions** | 3 entries pinned: ID=10 (pos 1), ID=20 (pos 2), ID=30 (pos 3) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_pin(action="reorder", entry_id=30, order=1)` | Response: success=true, entry 30 moved to position 1 |
| 2 | Call `mem_pin(action="list")` | Order: ID=30 (pos 1), ID=10 (pos 2), ID=20 (pos 3) |
| 3 | Call `mem_pin(action="get_context")` | Context returns entries in new order: 30, 10, 20 |

**Test Data:** entry_id=30, order=1
**Postconditions:** Entry 30 at position 1, others shifted down

---

### TC-005: Save Conversation Turn — Happy Path

| Field | Value |
|-------|-------|
| **ID** | TC-005 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-03, BR-07, BR-08, Story 2 AC-1 |
| **Preconditions** | MCP server running (Python/Kotlin), no existing sessions |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_conversation(action="save_turn", session_id="test-session-1", role="user", content="Find all TODO items")` | Response: turn saved, turn_id returned, session created |
| 2 | Call `mem_conversation(action="save_turn", session_id="test-session-1", role="assistant", content="Found 5 TODO items in src/")` | Response: turn saved, sequence_num=2 |
| 3 | Call `mem_conversation(action="get_session", session_id="test-session-1")` | Returns 2 turns in order, correct roles and content |

**Test Data:** session_id="test-session-1", role="user"/"assistant", content as specified
**Postconditions:** Session "test-session-1" exists with 2 turns

---

### TC-006: Get Session with All Turns

| Field | Value |
|-------|-------|
| **ID** | TC-006 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-03, BR-08, Story 2 AC-2 |
| **Preconditions** | Session "s1" exists with 10 turns (alternating user/assistant) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_conversation(action="get_session", session_id="s1")` | Returns all 10 turns |
| 2 | Verify turn ordering | Turns ordered by sequence_num (1 to 10) |
| 3 | Verify each turn has: id, role, content, timestamp | All fields present and non-null |

**Test Data:** Pre-seeded session "s1" with 10 turns
**Postconditions:** No state change (read-only)

---

### TC-007: Search Conversation History

| Field | Value |
|-------|-------|
| **ID** | TC-007 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-04, BR-11, Story 2 AC-4 |
| **Preconditions** | Multiple sessions exist with varied content, some containing "authentication" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_conversation(action="search", query="authentication")` | Returns turns containing "authentication" |
| 2 | Verify results are ranked by relevance | Most relevant matches first |
| 3 | Verify result limit | Max 20 results returned |

**Test Data:** 3 sessions, 2 containing "authentication" in different turns
**Postconditions:** No state change

---

### TC-008: Search by Entity Name

| Field | Value |
|-------|-------|
| **ID** | TC-008 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-05, BR-16, Story 3 AC-1 |
| **Preconditions** | KB entries exist with extracted entities including "AuthService" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_map(action="search_entity", entity="AuthService")` | Returns entries mentioning AuthService |
| 2 | Call `mem_map(action="search_entity", entity="authservice")` | Same results (case-insensitive per BR-16) |
| 3 | Verify results include entry_id, summary, context | All fields present |

**Test Data:** 3 entries mentioning "AuthService", 2 mentioning "UserRepo"
**Postconditions:** No state change

---

### TC-009: Re-extract Structured Map

| Field | Value |
|-------|-------|
| **ID** | TC-009 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | UC-06, BR-13, BR-14, BR-15 |
| **Preconditions** | Entry ID=15 exists with content containing code identifiers and decisions |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_map(action="reextract", entry_id=15)` | New structured map generated |
| 2 | Verify entities extracted | PascalCase identifiers found (e.g., "CoreMemoryManager") |
| 3 | Verify topic extracted | Primary topic identified |
| 4 | Verify decisions extracted | Decision patterns found |

**Test Data:** Entry 15 content: "Decision: Use CoreMemoryManager for pin operations. The AuthService handles token validation."
**Postconditions:** Entry 15's structured_map column updated

---

### TC-010: Cache Hit — Lookup Returns Cached Value

| Field | Value |
|-------|-------|
| **ID** | TC-010 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-07, BR-19, BR-26, Story 4 AC-1 |
| **Preconditions** | Node.js cache initialized, previous lookup stored: cache.set("registry", "key1", {tools: [...]}) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `cache.get("registry", "key1")` | Returns cached value {tools: [...]} |
| 2 | Verify latency | Response time < 1ms |
| 3 | Verify hit counter incremented | hitCount for key1 increased by 1 |
| 4 | Verify LRU position updated | key1 moved to front of LRU list |

**Test Data:** Pre-cached entry: type="registry", key="key1", value={tools: ["mem_pin", "mem_search"]}
**Postconditions:** Cache entry accessed, metrics updated

---

### TC-011: File Change Triggers Re-index

| Field | Value |
|-------|-------|
| **ID** | TC-011 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-09, BR-27, BR-28, Story 5 AC-1 |
| **Preconditions** | Node.js file watcher active, watching workspace directory |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Modify a .ts file in watched directory | File watcher detects change |
| 2 | Wait 500ms (debounce window) | No re-index triggered yet |
| 3 | Wait additional 100ms | Re-index triggered for modified file |
| 4 | Verify code index updated | File's symbols reflect new content |

**Test Data:** Modify `src/test-file.ts` — add a new function
**Postconditions:** Code index contains new function from modified file

---

### TC-012: Discover Child MCP Server

| Field | Value |
|-------|-------|
| **ID** | TC-012 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-11, BR-39, BR-43, Story 7 AC-1 |
| **Preconditions** | Kotlin parent MCP server running, child MCP server running with find_tools capability |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start child MCP server exposing tools: ["tool_a", "tool_b"] | Child server available |
| 2 | Parent detects child connection | Child's tools discovered via find_tools |
| 3 | Verify parent registry | Contains "child1.tool_a" and "child1.tool_b" |
| 4 | Call find_tools on parent | Results include child's tools with server attribution |

**Test Data:** Child server name="child1", tools=["tool_a", "tool_b"]
**Postconditions:** Parent registry contains child's tools with "child1." prefix

---

## 2. Functional Test Cases — Alternative Flows

### TC-100: Pin Entry Already Pinned (AF-1)

| Field | Value |
|-------|-------|
| **ID** | TC-100 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-01 AF-1 |
| **Preconditions** | Entry 42 already pinned at position 2 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_pin(action="pin", entry_id=42)` | Response: "Entry 42 is already pinned at position 2" |
| 2 | Call `mem_pin(action="list")` | Entry 42 still at position 2, no duplicate |

**Test Data:** entry_id=42 (already pinned)
**Postconditions:** No state change

---

### TC-101: Pin Entry Exceeds Budget (AF-2)

| Field | Value |
|-------|-------|
| **ID** | TC-101 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-01 AF-2, BR-01, Story 1 AC-2 |
| **Preconditions** | Current pinned entries total 1900 tokens, new entry has 200 tokens |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_pin(action="pin", entry_id=99)` | Error: "Cannot pin: entry uses 200 tokens, only 100 remaining of 2000 budget" |
| 2 | Call `mem_pin(action="list")` | Entry 99 NOT in list |
| 3 | Call `mem_pin(action="budget")` | Shows 1900/2000 used, 100 remaining |

**Test Data:** entry_id=99 (200 tokens summary), current budget usage=1900/2000
**Postconditions:** Entry 99 not pinned, budget unchanged

---

### TC-102: Auto-Recall with No Pinned Entries (AF-1)

| Field | Value |
|-------|-------|
| **ID** | TC-102 |
| **Priority** | Medium |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-02 AF-1 |
| **Preconditions** | No entries pinned |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_pin(action="get_context")` | Returns empty string with message "No pinned entries" |
| 2 | Verify token_count | token_count = 0 |
| 3 | Verify entries_count | entries_count = 0 |

**Test Data:** None
**Postconditions:** No state change

---

### TC-103: Save Turn with Auto-Generated Session ID (AF-1)

| Field | Value |
|-------|-------|
| **ID** | TC-103 |
| **Priority** | Medium |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-03 AF-1, BR-07 |
| **Preconditions** | No existing sessions |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_conversation(action="save_turn", role="user", content="hello")` (no session_id) | Turn saved, auto-generated session_id returned (format: session-YYYY-MM-DD-HHmmss) |
| 2 | Call `mem_conversation(action="list_sessions")` | New session appears with auto-generated ID |

**Test Data:** No session_id provided
**Postconditions:** New session created with auto-generated ID

---

### TC-104: Session at Max Turns — Archive Oldest (AF-2)

| Field | Value |
|-------|-------|
| **ID** | TC-104 |
| **Priority** | Medium |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-03 AF-2, BR-10 |
| **Preconditions** | Session "s-full" has exactly 1000 turns |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_conversation(action="save_turn", session_id="s-full", role="user", content="turn 1001")` | Turn saved successfully |
| 2 | Call `mem_conversation(action="get_session", session_id="s-full")` | Oldest 100 turns archived, current count ≤ 1000 |

**Test Data:** Session with 1000 turns, new turn content="turn 1001"
**Postconditions:** Oldest turns archived, new turn persisted

---

### TC-105: Search with No Results (AF-1)

| Field | Value |
|-------|-------|
| **ID** | TC-105 |
| **Priority** | Medium |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-04 AF-1 |
| **Preconditions** | Sessions exist but none contain "xyznonexistent" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_conversation(action="search", query="xyznonexistent")` | Returns empty array |
| 2 | Verify response includes suggestion | Message suggests broadening query |

**Test Data:** query="xyznonexistent"
**Postconditions:** No state change

---

### TC-106: Entity Search — Not Found, Suggest Similar (AF-1)

| Field | Value |
|-------|-------|
| **ID** | TC-106 |
| **Priority** | Medium |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-05 AF-1 |
| **Preconditions** | Entities "AuthService", "AuthController" exist in index |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_map(action="search_entity", entity="AuthServic")` (typo) | Returns empty or fuzzy matches with similarity score |
| 2 | Verify suggestions | Suggests "AuthService" as similar entity |

**Test Data:** entity="AuthServic" (missing 'e')
**Postconditions:** No state change

---

### TC-107: Cache Miss — Entry Expired (AF-1)

| Field | Value |
|-------|-------|
| **ID** | TC-107 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-07 AF-1, BR-24 |
| **Preconditions** | Cache entry exists with TTL=300s, entry created 301s ago |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `cache.get("kb_search", "expired-key")` | Returns null (cache miss) |
| 2 | Verify entry removed from cache | Entry no longer in cache map |
| 3 | Verify miss counter incremented | missCount increased by 1 |

**Test Data:** Cache entry with TTL=300000ms, created_at = now - 301000ms
**Postconditions:** Expired entry removed from cache

---

### TC-108: Cache Miss — Entry Not Found (AF-2)

| Field | Value |
|-------|-------|
| **ID** | TC-108 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-07 AF-2 |
| **Preconditions** | Cache initialized, key "nonexistent" never stored |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `cache.get("registry", "nonexistent")` | Returns null |
| 2 | Caller fetches from source | Source returns actual value |
| 3 | Call `cache.set("registry", "nonexistent", value)` | Entry cached for future lookups |

**Test Data:** key="nonexistent"
**Postconditions:** New cache entry created

---

### TC-109: File Watcher — Excluded Pattern Ignored (AF-1)

| Field | Value |
|-------|-------|
| **ID** | TC-109 |
| **Priority** | Medium |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-09 AF-1, BR-30, Story 5 AC-3 |
| **Preconditions** | File watcher active with default exclude patterns |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Modify file in `node_modules/package/index.js` | File watcher receives event |
| 2 | Verify no re-index triggered | Re-index NOT called (file matches exclude pattern) |

**Test Data:** Modify `node_modules/lodash/index.js`
**Postconditions:** No re-index, no state change

---

### TC-110: File Watcher — Large Batch Triggers Full Re-index (AF-2)

| Field | Value |
|-------|-------|
| **ID** | TC-110 |
| **Priority** | High |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-09 AF-2, BR-29, Story 5 AC-2 |
| **Preconditions** | File watcher active, batch_threshold=50 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Simultaneously modify 55 source files (simulate git checkout) | File watcher batches all changes |
| 2 | Wait for debounce expiry (500ms) | Batch size > 50 detected |
| 3 | Verify full re-index triggered | Full workspace re-index (not 55 individual re-indexes) |

**Test Data:** 55 .ts files modified simultaneously
**Postconditions:** Full workspace re-index completed

---

### TC-111: Viewer UI Disabled by Default (AF-1)

| Field | Value |
|-------|-------|
| **ID** | TC-111 |
| **Priority** | Medium |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-10 AF-1, BR-33, BR-38 |
| **Preconditions** | MCP server started with default config (viewer_enabled=false) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Attempt HTTP GET to localhost:8765 | Connection refused (no port opened) |
| 2 | Verify no resource consumption | No HTTP server thread/process running |

**Test Data:** Default configuration
**Postconditions:** No viewer resources allocated

---

### TC-112: Child Server Without find_tools (AF-1)

| Field | Value |
|-------|-------|
| **ID** | TC-112 |
| **Priority** | Medium |
| **Type** | Functional — Alternative Flow |
| **Requirement** | UC-11 AF-1 |
| **Preconditions** | Child MCP server running but does NOT expose find_tools |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parent attempts to detect child | Child connection established |
| 2 | Parent calls child's tools/list | find_tools not in tool list |
| 3 | Verify child skipped | Child not registered as nested server, info logged |

**Test Data:** Child server with tools=["some_tool"] (no find_tools)
**Postconditions:** Child not in nested registry

---

## 3. Functional Test Cases — Exception/Error Flows

### TC-200: Pin Non-Existent Entry (EF-1)

| Field | Value |
|-------|-------|
| **ID** | TC-200 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | UC-01 EF-1, FSD 3.1.6 |
| **Preconditions** | Entry ID=9999 does not exist in knowledge base |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_pin(action="pin", entry_id=9999)` | Error: "Entry 9999 not found in knowledge base" |
| 2 | Call `mem_pin(action="list")` | No change to pinned list |

**Test Data:** entry_id=9999 (non-existent)
**Postconditions:** No state change, no side effects

---

### TC-201: Pin with Database Write Failure (EF-2)

| Field | Value |
|-------|-------|
| **ID** | TC-201 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | UC-01 EF-2 |
| **Preconditions** | Database in read-only mode (simulate disk full or permission error) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_pin(action="pin", entry_id=42)` | Error: "Failed to pin entry. Database error." |
| 2 | Verify no partial state | Entry not partially pinned |

**Test Data:** entry_id=42, DB set to read-only
**Postconditions:** No state change, system stable

---

### TC-202: Save Turn with Invalid Role (EF-1)

| Field | Value |
|-------|-------|
| **ID** | TC-202 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | UC-03 EF-1, FSD 3.2.6 |
| **Preconditions** | MCP server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_conversation(action="save_turn", session_id="s1", role="invalid_role", content="test")` | Error: "Invalid role. Use: user, assistant, system, tool" |
| 2 | Verify no turn saved | Session "s1" turn count unchanged |

**Test Data:** role="invalid_role"
**Postconditions:** No turn persisted

---

### TC-203: Save Turn with Content Exceeding Max Length (EF-2)

| Field | Value |
|-------|-------|
| **ID** | TC-203 |
| **Priority** | Medium |
| **Type** | Functional — Exception Flow |
| **Requirement** | UC-03 EF-2, FSD 3.2.5 |
| **Preconditions** | MCP server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_conversation(action="save_turn", session_id="s1", role="user", content=<15000 chars>)` | Turn saved with content truncated to 10,000 chars, warning returned |
| 2 | Call `mem_conversation(action="get_session", session_id="s1")` | Last turn content length = 10,000 |

**Test Data:** content = "x" * 15000
**Postconditions:** Turn saved with truncated content

---

### TC-204: Get Non-Existent Session

| Field | Value |
|-------|-------|
| **ID** | TC-204 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | FSD 3.2.6 |
| **Preconditions** | Session "nonexistent-session" does not exist |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_conversation(action="get_session", session_id="nonexistent-session")` | Error: "Session 'nonexistent-session' not found" |

**Test Data:** session_id="nonexistent-session"
**Postconditions:** No state change

---

### TC-205: Search Entity with Empty String (EF-1)

| Field | Value |
|-------|-------|
| **ID** | TC-205 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | UC-05 EF-1, FSD 3.3.6 |
| **Preconditions** | MCP server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_map(action="search_entity", entity="")` | Error: "Entity name is required" |

**Test Data:** entity="" (empty string)
**Postconditions:** No state change

---

### TC-206: Re-extract Map for Non-Existent Entry

| Field | Value |
|-------|-------|
| **ID** | TC-206 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | FSD 3.3.6 |
| **Preconditions** | Entry ID=9999 does not exist |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_map(action="reextract", entry_id=9999)` | Error: "Entry 9999 not found" |

**Test Data:** entry_id=9999
**Postconditions:** No state change

---

### TC-207: Invalid Action Parameter

| Field | Value |
|-------|-------|
| **ID** | TC-207 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | FSD 3.1.6, 3.2.6, 3.3.6 |
| **Preconditions** | MCP server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_pin(action="invalid_action")` | Error: "Invalid action. Use: pin, unpin, list, reorder, get_context, budget" |
| 2 | Call `mem_conversation(action="invalid_action")` | Error: "Invalid action. Use: save_turn, get_session, list_sessions, search, summarize" |
| 3 | Call `mem_map(action="invalid_action")` | Error: "Invalid action. Use: get, update, search_entity, search_topic, reextract" |

**Test Data:** action="invalid_action" for each tool
**Postconditions:** No state change

---

### TC-208: File Watcher Permission Denied (EF-1)

| Field | Value |
|-------|-------|
| **ID** | TC-208 |
| **Priority** | Medium |
| **Type** | Functional — Exception Flow |
| **Requirement** | UC-09 EF-1, BR-31, Story 5 AC-4 |
| **Preconditions** | File watcher active, one file has restricted permissions |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Modify a file with restricted read permissions | Watcher receives event |
| 2 | Watcher attempts to read file for indexing | Permission denied error |
| 3 | Verify watcher continues | Warning logged, other files still watched |

**Test Data:** File with 000 permissions (Unix) or read-denied ACL (Windows)
**Postconditions:** Watcher still active, only problematic file skipped

---

### TC-209: Child Server Disconnects (EF-1)

| Field | Value |
|-------|-------|
| **ID** | TC-209 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | UC-11 EF-1, BR-41, Story 7 AC-2 |
| **Preconditions** | Child "child1" connected with tools registered |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Kill child server process | Parent detects disconnect |
| 2 | Call `child1.tool_a` | Error: "Tool unavailable — child server 'child1' disconnected" |
| 3 | Verify retry starts | Exponential backoff retry initiated (1s, 2s, 4s...) |
| 4 | Verify tools marked unavailable | child1.tool_a and child1.tool_b marked unavailable=false |

**Test Data:** Child server "child1" killed
**Postconditions:** Child tools unavailable, retry in progress

---

### TC-210: Child Server Tool Call Timeout (EF-2)

| Field | Value |
|-------|-------|
| **ID** | TC-210 |
| **Priority** | High |
| **Type** | Functional — Exception Flow |
| **Requirement** | UC-12 EF-2, BR-44 |
| **Preconditions** | Child "child1" connected but tool execution hangs |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `child1.slow_tool` (tool that never responds) | Wait for timeout |
| 2 | After 30 seconds | Error: "Tool call timed out after 30s" |
| 3 | Verify child marked degraded | child1 status = "degraded" |

**Test Data:** Mock child with tool that sleeps indefinitely
**Postconditions:** Child marked degraded, tool call failed

---

### TC-211: Viewer Port Already in Use (EF-1)

| Field | Value |
|-------|-------|
| **ID** | TC-211 |
| **Priority** | Medium |
| **Type** | Functional — Exception Flow |
| **Requirement** | UC-10 EF-1 |
| **Preconditions** | Port 8765 already occupied by another process |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start MCP server with viewer_enabled=true, viewer_port=8765 | Port conflict detected |
| 2 | Verify MCP server continues | MCP server starts normally (viewer disabled) |
| 3 | Verify error logged | Log: "Viewer port 8765 in use, viewer disabled" |

**Test Data:** Pre-occupy port 8765
**Postconditions:** MCP server running without viewer, no crash

---

## 4. Business Rule Validation

### TC-300: BR-01 — Maximum Pinned Context Budget 2000 Tokens

| Field | Value |
|-------|-------|
| **ID** | TC-300 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-01 |
| **Preconditions** | No entries pinned |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Pin entries until total reaches exactly 2000 tokens | All entries pinned successfully |
| 2 | Attempt to pin one more entry (any size > 0) | Rejected: budget exceeded |
| 3 | Call `mem_pin(action="budget")` | Shows 2000/2000 used, 0 remaining |

**Test Data:** Entries with known token counts summing to 2000

---

### TC-301: BR-02 — Pin/Unpin Operations Atomic and Persist Immediately

| Field | Value |
|-------|-------|
| **ID** | TC-301 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-02 |
| **Preconditions** | Entry 42 exists, not pinned |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_pin(action="pin", entry_id=42)` | Success |
| 2 | Immediately query DB directly: `SELECT pinned FROM knowledge_entries WHERE id=42` | pinned=1 (persisted) |
| 3 | Restart MCP server | |
| 4 | Call `mem_pin(action="list")` | Entry 42 still pinned (survived restart) |

**Test Data:** entry_id=42

---

### TC-302: BR-03 — Reorder Changes Position of All Affected Entries

| Field | Value |
|-------|-------|
| **ID** | TC-302 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-03 |
| **Preconditions** | 5 entries pinned at positions 1-5 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_pin(action="reorder", entry_id=<pos5>, order=2)` | Entry moved from pos 5 to pos 2 |
| 2 | Call `mem_pin(action="list")` | Entries at pos 2,3,4 shifted to 3,4,5 respectively |
| 3 | Verify all positions are contiguous (1,2,3,4,5) | No gaps in positions |

**Test Data:** 5 entries with IDs 10,20,30,40,50 at positions 1-5

---

### TC-303: BR-05 — Budget Uses Token Count of Summary, Not Full Content

| Field | Value |
|-------|-------|
| **ID** | TC-303 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-05 |
| **Preconditions** | Entry with full content=4000 chars (1000 tokens) but summary=100 chars (25 tokens) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_pin(action="pin", entry_id=<entry>)` | Pinned successfully |
| 2 | Call `mem_pin(action="budget")` | Budget shows 25 tokens used (not 1000) |

**Test Data:** Entry with long content but short summary

---

### TC-304: BR-06 — Behavior Matches Node.js Reference Exactly

| Field | Value |
|-------|-------|
| **ID** | TC-304 |
| **Priority** | Critical |
| **Type** | Business Rule |
| **Requirement** | BR-06 |
| **Preconditions** | Same test data loaded in Node.js, Python, and Kotlin |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_pin(action="pin", entry_id=1)` on all 3 implementations | Identical JSON response structure |
| 2 | Call `mem_pin(action="get_context")` on all 3 | Identical context string |
| 3 | Call `mem_pin(action="list")` on all 3 | Identical list structure and values |

**Test Data:** Identical DB state across all 3 implementations

---

### TC-305: BR-07 — Sessions Identified by User-Provided or Auto-Generated ID

| Field | Value |
|-------|-------|
| **ID** | TC-305 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-07 |
| **Preconditions** | No sessions exist |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call save_turn with session_id="my-custom-session" | Session created with ID "my-custom-session" |
| 2 | Call save_turn without session_id | Session created with auto-generated ID (format: session-YYYY-MM-DD-HHmmss) |
| 3 | Call list_sessions | Both sessions listed with correct IDs |

**Test Data:** session_id="my-custom-session" and omitted

---

### TC-306: BR-08 — Turns Ordered by Sequence Number

| Field | Value |
|-------|-------|
| **ID** | TC-306 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-08 |
| **Preconditions** | Session "s1" exists |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Save 5 turns rapidly to session "s1" | All saved with sequential sequence_nums |
| 2 | Call get_session("s1") | Turns returned in sequence_num order (1,2,3,4,5) |
| 3 | Verify no gaps | sequence_nums are contiguous |

**Test Data:** 5 turns with different content

---

### TC-307: BR-11 — Search Uses SQLite FTS5

| Field | Value |
|-------|-------|
| **ID** | TC-307 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-11 |
| **Preconditions** | Turns exist with content: "authentication flow", "auth token expired", "user login" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_conversation(action="search", query="auth")` | Returns turns with "authentication" and "auth" (FTS5 prefix matching) |
| 2 | Verify "user login" NOT returned | FTS5 correctly excludes non-matching content |

**Test Data:** Turns with varied content including "auth" prefix matches

---

### TC-308: BR-13 — Entity Extraction Uses Regex for Code Identifiers

| Field | Value |
|-------|-------|
| **ID** | TC-308 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-13 |
| **Preconditions** | Entry with content containing PascalCase and camelCase identifiers |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ingest entry with content: "The CoreMemoryManager uses authService to validate tokens via UserRepository" | Entry ingested |
| 2 | Call `mem_map(action="get", entry_id=<new>)` | entities includes: "CoreMemoryManager", "UserRepository" (PascalCase) |
| 3 | Verify camelCase handling | "authService" may or may not be extracted (implementation-specific) |

**Test Data:** Content with mixed PascalCase/camelCase identifiers

---

### TC-309: BR-16 — Entity Search is Case-Insensitive

| Field | Value |
|-------|-------|
| **ID** | TC-309 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-16 |
| **Preconditions** | Entity "AuthService" indexed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_map(action="search_entity", entity="AuthService")` | Returns results |
| 2 | Call `mem_map(action="search_entity", entity="authservice")` | Same results |
| 3 | Call `mem_map(action="search_entity", entity="AUTHSERVICE")` | Same results |

**Test Data:** entity variations: "AuthService", "authservice", "AUTHSERVICE"

---

### TC-310: BR-19 — Cache LRU Eviction When Max Size Exceeded

| Field | Value |
|-------|-------|
| **ID** | TC-310 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-19, BR-25 |
| **Preconditions** | Cache partition "registry" at max_size=5 (for testing), 5 entries stored |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Note oldest entry (least recently accessed): key="oldest" | |
| 2 | Call `cache.set("registry", "new-key", value)` | New entry stored |
| 3 | Call `cache.get("registry", "oldest")` | Returns null (evicted) |
| 4 | Verify cache size still = max_size | Size = 5 |

**Test Data:** 5 pre-cached entries, new entry to trigger eviction

---

### TC-311: BR-21 — Registry Cache Invalidated on Tool Register/Unregister

| Field | Value |
|-------|-------|
| **ID** | TC-311 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-21 |
| **Preconditions** | Registry cache has entries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify cache has registry entries | cache.getStats().registry.size > 0 |
| 2 | Emit "registry_changed" event (simulate tool registration) | |
| 3 | Verify registry cache cleared | cache.getStats().registry.size = 0 |
| 4 | Other cache partitions unchanged | kb_search and code_intel sizes unchanged |

**Test Data:** Pre-cached registry entries

---

### TC-312: BR-24 — Default TTL Values

| Field | Value |
|-------|-------|
| **ID** | TC-312 |
| **Priority** | Medium |
| **Type** | Business Rule |
| **Requirement** | BR-24 |
| **Preconditions** | Cache initialized with default config |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Store entry in "registry" cache | TTL = 600s (600000ms) |
| 2 | Store entry in "kb_search" cache | TTL = 300s (300000ms) |
| 3 | Store entry in "code_intel" cache | TTL = 120s (120000ms) |
| 4 | Verify each entry expires at correct time | Entries expire per their TTL |

**Test Data:** Default configuration

---

### TC-313: BR-27 — Debounce Window 500ms

| Field | Value |
|-------|-------|
| **ID** | TC-313 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-27 |
| **Preconditions** | File watcher active |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Modify file A at T=0ms | Change queued |
| 2 | Modify file B at T=200ms | Change queued, debounce timer reset |
| 3 | Modify file C at T=400ms | Change queued, debounce timer reset |
| 4 | Wait until T=900ms (400+500) | Re-index triggered with files [A, B, C] |
| 5 | Verify single batch | Only 1 re-index call (not 3) |

**Test Data:** 3 files modified within 500ms window

---

### TC-314: BR-34 — Viewer Binds to Localhost Only

| Field | Value |
|-------|-------|
| **ID** | TC-314 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-34 |
| **Preconditions** | Viewer enabled, server started |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | HTTP GET to 127.0.0.1:8765 | Dashboard loads (200 OK) |
| 2 | HTTP GET to <machine-ip>:8765 from another machine | Connection refused |

**Test Data:** viewer_host="127.0.0.1"

---

### TC-315: BR-39 — Child Tools Prefixed with Server Name

| Field | Value |
|-------|-------|
| **ID** | TC-315 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-39 |
| **Preconditions** | Child server "analytics" connected with tools ["analyze", "report"] |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify parent registry | Contains "analytics.analyze" and "analytics.report" |
| 2 | Call find_tools("analyze") | Returns "analytics.analyze" with server attribution |

**Test Data:** Child server_name="analytics", tools=["analyze", "report"]

---

### TC-316: BR-41 — Disconnect Retry with Exponential Backoff

| Field | Value |
|-------|-------|
| **ID** | TC-316 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-41, BR-45 |
| **Preconditions** | Child "child1" connected |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Kill child1 process | Disconnect detected |
| 2 | Verify retry attempt 1 at ~1s | Connection attempt made |
| 3 | Verify retry attempt 2 at ~3s (1+2) | Connection attempt made |
| 4 | Verify retry attempt 3 at ~7s (1+2+4) | Connection attempt made |
| 5 | After 5 failed retries | Child marked permanently disconnected |

**Test Data:** Child that stays down for all retries

---

### TC-317: BR-44 — Tool Call Timeout 30 Seconds

| Field | Value |
|-------|-------|
| **ID** | TC-317 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-44 |
| **Preconditions** | Child connected with slow tool |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call child tool that takes 35 seconds | Wait... |
| 2 | At 30 seconds | Timeout error returned: "Tool call timed out after 30s" |
| 3 | Verify call did not wait full 35s | Response received at ~30s mark |

**Test Data:** Mock child tool with 35s sleep

---

### TC-318: BR-35 — Real-Time Updates via SSE

| Field | Value |
|-------|-------|
| **ID** | TC-318 |
| **Priority** | Medium |
| **Type** | Business Rule |
| **Requirement** | BR-35 |
| **Preconditions** | Viewer enabled, SSE connection established |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Connect to /api/events (SSE endpoint) | Connection established |
| 2 | Ingest a new KB entry via mem_ingest | |
| 3 | Verify SSE event received | Event type="kb_entry_added", data contains entry_id and summary |

**Test Data:** New KB entry to ingest

---

## 5. Boundary & Negative Testing

### TC-400: Pin with entry_id = 0 (Invalid)

| Field | Value |
|-------|-------|
| **ID** | TC-400 |
| **Priority** | Medium |
| **Type** | Boundary |
| **Requirement** | FSD 3.1.5 — entry_id must be positive integer |
| **Preconditions** | MCP server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_pin(action="pin", entry_id=0)` | Error: entry not found or invalid ID |
| 2 | Call `mem_pin(action="pin", entry_id=-1)` | Error: invalid entry_id |

**Test Data:** entry_id=0, entry_id=-1

---

### TC-401: Pin with Missing Required Parameter (action)

| Field | Value |
|-------|-------|
| **ID** | TC-401 |
| **Priority** | Medium |
| **Type** | Negative |
| **Requirement** | FSD 3.1.5 — action is required |
| **Preconditions** | MCP server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_pin()` with no parameters | Error: action is required |
| 2 | Call `mem_pin(entry_id=42)` without action | Error: action is required |

**Test Data:** No action parameter

---

### TC-402: Session ID at Maximum Length (100 chars)

| Field | Value |
|-------|-------|
| **ID** | TC-402 |
| **Priority** | Medium |
| **Type** | Boundary |
| **Requirement** | FSD 3.2.5 — session_id max 100 chars |
| **Preconditions** | MCP server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call save_turn with session_id = "a" * 100 | Turn saved successfully (boundary) |
| 2 | Call save_turn with session_id = "a" * 101 | Error: session_id exceeds max length |

**Test Data:** session_id of 100 chars (valid) and 101 chars (invalid)

---

### TC-403: Content at Maximum Length (10,000 chars)

| Field | Value |
|-------|-------|
| **ID** | TC-403 |
| **Priority** | Medium |
| **Type** | Boundary |
| **Requirement** | FSD 3.2.5 — content max 10,000 chars |
| **Preconditions** | MCP server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call save_turn with content = "x" * 10000 | Turn saved successfully (at boundary) |
| 2 | Call save_turn with content = "x" * 10001 | Content truncated to 10,000 with warning |

**Test Data:** content of exactly 10,000 and 10,001 chars

---

### TC-404: Search Query at Maximum Length (500 chars)

| Field | Value |
|-------|-------|
| **ID** | TC-404 |
| **Priority** | Medium |
| **Type** | Boundary |
| **Requirement** | FSD 3.2.5 — query max 500 chars |
| **Preconditions** | Sessions with content exist |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call search with query = "a" * 500 | Search executes (may return no results) |
| 2 | Call search with query = "a" * 501 | Error or query truncated |

**Test Data:** query of 500 and 501 chars

---

### TC-405: Entity Name at Maximum Length (200 chars)

| Field | Value |
|-------|-------|
| **ID** | TC-405 |
| **Priority** | Medium |
| **Type** | Boundary |
| **Requirement** | FSD 3.3.5 — entity max 200 chars |
| **Preconditions** | MCP server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call search_entity with entity = "A" * 200 | Search executes (returns empty) |
| 2 | Call search_entity with entity = "A" * 201 | Error or entity truncated |

**Test Data:** entity of 200 and 201 chars

---

### TC-406: Cache with Invalid Cache Type

| Field | Value |
|-------|-------|
| **ID** | TC-406 |
| **Priority** | Medium |
| **Type** | Negative |
| **Requirement** | FSD 3.4.6 |
| **Preconditions** | Cache initialized |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `cache.get("invalid_type", "key")` | Configuration error thrown |
| 2 | Call `cache.set("invalid_type", "key", value)` | Configuration error thrown |

**Test Data:** cache_type="invalid_type"

---

### TC-407: Reorder to Position Beyond Total Count

| Field | Value |
|-------|-------|
| **ID** | TC-407 |
| **Priority** | Medium |
| **Type** | Boundary |
| **Requirement** | FSD 3.1.5 — order ≤ total pinned count |
| **Preconditions** | 3 entries pinned (positions 1-3) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_pin(action="reorder", entry_id=<pos1>, order=5)` | Error: order exceeds total pinned count (3) |
| 2 | Call `mem_pin(action="list")` | No change to positions |

**Test Data:** order=5 when only 3 entries pinned

---

### TC-408: Save Turn with Empty Content

| Field | Value |
|-------|-------|
| **ID** | TC-408 |
| **Priority** | Medium |
| **Type** | Negative |
| **Requirement** | FSD 3.2.6 |
| **Preconditions** | MCP server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_conversation(action="save_turn", session_id="s1", role="user", content="")` | Error: "Content is required for save_turn" |

**Test Data:** content="" (empty string)

---

### TC-409: Cache Max Size Boundary (100 and 100000)

| Field | Value |
|-------|-------|
| **ID** | TC-409 |
| **Priority** | Medium |
| **Type** | Boundary |
| **Requirement** | FSD 3.4.5 — max_size 100-100000 |
| **Preconditions** | Cache configuration |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Configure cache with max_size=100 | Accepted |
| 2 | Configure cache with max_size=99 | Rejected (below minimum) |
| 3 | Configure cache with max_size=100000 | Accepted |
| 4 | Configure cache with max_size=100001 | Rejected (above maximum) |

**Test Data:** max_size values at boundaries

---

### TC-410: Conversation Limit Parameter Boundary

| Field | Value |
|-------|-------|
| **ID** | TC-410 |
| **Priority** | Medium |
| **Type** | Boundary |
| **Requirement** | FSD 3.2.5 — limit 1-100 |
| **Preconditions** | Session with 50 turns exists |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call search with limit=1 | Returns exactly 1 result |
| 2 | Call search with limit=100 | Returns up to 100 results |
| 3 | Call search with limit=0 | Error or uses default (20) |
| 4 | Call search with limit=101 | Error or capped at 100 |

**Test Data:** limit values: 0, 1, 100, 101

---

## 6. Non-Functional Testing (Performance)

### TC-600: Core Memory Auto-Recall < 5ms

| Field | Value |
|-------|-------|
| **ID** | TC-600 |
| **Priority** | Medium |
| **Type** | Non-Functional — Performance |
| **Requirement** | BRD NFR, FSD Section 8 |
| **Preconditions** | 5 entries pinned (typical load) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Measure time for `mem_pin(action="get_context")` | Response time < 5ms |
| 2 | Repeat 100 times | Average < 5ms, P99 < 10ms |

**Acceptance Criteria:** Auto-recall completes in < 5ms for up to 10 pinned entries

---

### TC-601: Conversation Search < 50ms

| Field | Value |
|-------|-------|
| **ID** | TC-601 |
| **Priority** | Medium |
| **Type** | Non-Functional — Performance |
| **Requirement** | BRD NFR, FSD Section 8 |
| **Preconditions** | 50 sessions with 100 turns each (5000 total turns) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Measure time for `mem_conversation(action="search", query="authentication")` | Response time < 50ms |
| 2 | Repeat with different queries | All < 50ms |

**Acceptance Criteria:** FTS5 search across all sessions completes in < 50ms

---

### TC-602: Cache Hit Latency < 1ms

| Field | Value |
|-------|-------|
| **ID** | TC-602 |
| **Priority** | Medium |
| **Type** | Non-Functional — Performance |
| **Requirement** | BRD NFR, FSD Section 8 |
| **Preconditions** | Cache with 500 entries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Measure time for `cache.get("registry", "existing-key")` | Response time < 1ms |
| 2 | Repeat 1000 times | Average < 0.5ms, P99 < 1ms |

**Acceptance Criteria:** In-memory cache lookup < 1ms

---

### TC-603: File Watcher Re-index Within 2 Seconds

| Field | Value |
|-------|-------|
| **ID** | TC-603 |
| **Priority** | Medium |
| **Type** | Non-Functional — Performance |
| **Requirement** | BR-28, BRD NFR |
| **Preconditions** | File watcher active, workspace with 100 files |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Modify single file | |
| 2 | Measure time from debounce expiry to index update complete | < 2 seconds |

**Acceptance Criteria:** Re-index completes within 2s of debounce expiry

---

### TC-604: Entity Search < 20ms

| Field | Value |
|-------|-------|
| **ID** | TC-604 |
| **Priority** | Medium |
| **Type** | Non-Functional — Performance |
| **Requirement** | TDD Section 13.1 |
| **Preconditions** | Entity index with 1000 entities across 200 entries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Measure time for `mem_map(action="search_entity", entity="AuthService")` | Response time < 20ms |
| 2 | Repeat with different entities | All < 20ms |

**Acceptance Criteria:** FTS5 entity search < 20ms

---

### TC-605: Schema V3 Migration — No Data Loss

| Field | Value |
|-------|-------|
| **ID** | TC-605 |
| **Priority** | High |
| **Type** | Non-Functional — Reliability |
| **Requirement** | BRD NFR — Schema migration reversible, no data loss |
| **Preconditions** | Existing V2 database with 100 knowledge entries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Count entries before migration | count_before = 100 |
| 2 | Apply V3 migration | Migration succeeds |
| 3 | Count entries after migration | count_after = 100 (no data loss) |
| 4 | Verify new columns exist | pinned, pin_order, structured_map columns present |
| 5 | Verify existing data intact | All original fields unchanged |

**Acceptance Criteria:** Zero data loss during schema migration

---

### TC-606: Cross-Platform Compatibility

| Field | Value |
|-------|-------|
| **ID** | TC-606 |
| **Priority** | Medium |
| **Type** | Non-Functional — Compatibility |
| **Requirement** | BRD NFR — Windows, macOS, Linux |
| **Preconditions** | Test environments for each OS |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run full test suite on Windows | All tests pass |
| 2 | Run full test suite on macOS | All tests pass |
| 3 | Run full test suite on Linux | All tests pass |
| 4 | Verify file paths handled correctly | No path separator issues |

**Acceptance Criteria:** All tests pass on all 3 OS platforms

---

## 7. Integration Testing

### TC-700: Tool Dispatcher → Core Memory Manager → DB Pipeline

| Field | Value |
|-------|-------|
| **ID** | TC-700 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | TDD Section 11.1, 11.2 |
| **Preconditions** | Full MCP server initialized with DB |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send MCP tool call: `mem_pin(action="pin", entry_id=1)` via MCP protocol | Tool dispatcher routes to CoreMemoryManager |
| 2 | Verify DB state | pinned_entries table has new row |
| 3 | Send MCP tool call: `mem_pin(action="get_context")` | Returns pinned context from DB |

**Test Data:** MCP JSON-RPC request for mem_pin
**Postconditions:** Entry pinned in DB, retrievable via get_context

---

### TC-701: Tool Dispatcher → Conversation Repository → DB Pipeline

| Field | Value |
|-------|-------|
| **ID** | TC-701 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | TDD Section 11.1, 11.2 |
| **Preconditions** | Full MCP server initialized with DB |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send MCP tool call: `mem_conversation(action="save_turn", ...)` | Dispatcher routes to ConversationRepository |
| 2 | Verify DB state | conversation_turns table has new row |
| 3 | Send MCP tool call: `mem_conversation(action="get_session", ...)` | Returns turns from DB |

**Test Data:** MCP JSON-RPC request for mem_conversation
**Postconditions:** Turn persisted, session retrievable

---

### TC-702: Ingest Pipeline → Auto-Extract Structured Map

| Field | Value |
|-------|-------|
| **ID** | TC-702 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | TDD Section 11.3, BR-15 |
| **Preconditions** | MCP server with StructuredMapExtractor hooked into ingest |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ingest new KB entry with content containing "CoreMemoryManager" | Entry ingested |
| 2 | Verify structured_map column | JSON contains entities: ["CoreMemoryManager"] |
| 3 | Verify entity_index table | Row with entity_name="CoreMemoryManager" exists |
| 4 | Call `mem_map(action="search_entity", entity="CoreMemoryManager")` | Returns the new entry |

**Test Data:** Content: "The CoreMemoryManager handles pin/unpin operations for auto-recall."
**Postconditions:** Entry has structured map, entity indexed

---

### TC-703: File Watcher → Code Indexer → Cache Invalidation

| Field | Value |
|-------|-------|
| **ID** | TC-703 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | TDD Section 11, BR-23 |
| **Preconditions** | File watcher active, cache has code_intel entries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify code_intel cache has entries | cache.getStats().code_intel.size > 0 |
| 2 | Modify a source file | File watcher detects change |
| 3 | Wait for debounce + re-index | Re-index completes |
| 4 | Verify code_intel cache invalidated | cache.getStats().code_intel.size = 0 |

**Test Data:** Modify any .ts file in workspace
**Postconditions:** Code index updated, cache cleared

---

### TC-704: Nested Detection → Tool Registry → Tool Call Routing

| Field | Value |
|-------|-------|
| **ID** | TC-704 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | TDD Section 10, 11 |
| **Preconditions** | Parent Kotlin server running, child server available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start child MCP server with tool "echo" | Child available |
| 2 | Parent detects and registers "child1.echo" | Tool in registry |
| 3 | Call "child1.echo" with args {message: "hello"} | Call forwarded to child |
| 4 | Verify response | Child returns {result: "hello"} |

**Test Data:** Child tool "echo" that returns input
**Postconditions:** End-to-end tool call routing verified

---

### TC-705: Core Memory Auto-Recall → Search Integration

| Field | Value |
|-------|-------|
| **ID** | TC-705 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | TDD Section 4.4 |
| **Preconditions** | Entries pinned, search functionality working |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Pin entry about "authentication" | Entry pinned |
| 2 | Call `mem_search(query="something unrelated")` | Search results include pinned context prepended |
| 3 | Verify pinned context appears before search results | Auto-recall context at top |

**Test Data:** Pinned entry about auth, search for unrelated topic
**Postconditions:** Pinned context always included in search results

---

## 8. Parity Testing (CRITICAL)

### TC-800: Python Core Memory Parity with Node.js

| Field | Value |
|-------|-------|
| **ID** | TC-800 |
| **Priority** | Critical |
| **Type** | Parity |
| **Requirement** | BR-06, Story 1 AC-5, FSD TC-25 |
| **Preconditions** | Identical DB state in Python and Node.js (same entries, same schema V3) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_pin(action="pin", entry_id=1)` on Node.js | Record response JSON |
| 2 | Call `mem_pin(action="pin", entry_id=1)` on Python | Response JSON identical to Node.js |
| 3 | Call `mem_pin(action="get_context")` on Node.js | Record context string |
| 4 | Call `mem_pin(action="get_context")` on Python | Context string identical to Node.js |
| 5 | Call `mem_pin(action="list")` on both | Identical list structure |
| 6 | Call `mem_pin(action="budget")` on both | Identical budget numbers |

**Test Data:** Identical DB with entries 1-10, entry 1 summary = "Test entry for parity validation"
**Postconditions:** Both implementations in identical state

---

### TC-801: Kotlin Core Memory Parity with Node.js

| Field | Value |
|-------|-------|
| **ID** | TC-801 |
| **Priority** | Critical |
| **Type** | Parity |
| **Requirement** | BR-06, Story 1 AC-5, FSD TC-26 |
| **Preconditions** | Identical DB state in Kotlin and Node.js |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_pin(action="pin", entry_id=1)` on Node.js | Record response JSON |
| 2 | Call `mem_pin(action="pin", entry_id=1)` on Kotlin | Response JSON identical to Node.js |
| 3 | Call `mem_pin(action="get_context")` on both | Identical context strings |
| 4 | Call `mem_pin(action="unpin", entry_id=1)` on both | Identical responses |
| 5 | Call `mem_pin(action="reorder", entry_id=2, order=1)` on both | Identical list after reorder |

**Test Data:** Identical DB with entries 1-10
**Postconditions:** Both implementations in identical state

---

### TC-802: Python Conversation Parity with Node.js

| Field | Value |
|-------|-------|
| **ID** | TC-802 |
| **Priority** | Critical |
| **Type** | Parity |
| **Requirement** | BR-12, Story 2 AC-5 |
| **Preconditions** | Empty DB in both Python and Node.js |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call `mem_conversation(action="save_turn", session_id="parity-test", role="user", content="hello")` on both | Identical response structure |
| 2 | Call `mem_conversation(action="get_session", session_id="parity-test")` on both | Identical session data (turns, metadata) |
| 3 | Call `mem_conversation(action="search", query="hello")` on both | Identical search results |
| 4 | Call `mem_conversation(action="list_sessions")` on both | Identical session list |

**Test Data:** Same save_turn calls in sequence on both implementations
**Postconditions:** Both have identical conversation state

---

### TC-803: Kotlin Conversation Parity with Node.js

| Field | Value |
|-------|-------|
| **ID** | TC-803 |
| **Priority** | Critical |
| **Type** | Parity |
| **Requirement** | BR-12, Story 2 AC-5, FSD TC-26 |
| **Preconditions** | Empty DB in both Kotlin and Node.js |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Execute same sequence of 10 save_turn calls on both | All succeed |
| 2 | Call get_session on both | Identical turn data |
| 3 | Call search with same query on both | Identical results (order may vary — compare as sets) |
| 4 | Call list_sessions on both | Identical session metadata |

**Test Data:** 10 turns with varied roles and content
**Postconditions:** Both have identical conversation state

---

### TC-804: Python Structured Map Parity with Node.js

| Field | Value |
|-------|-------|
| **ID** | TC-804 |
| **Priority** | Critical |
| **Type** | Parity |
| **Requirement** | BR-18, Story 3 AC-5 |
| **Preconditions** | Same entry content in both Python and Node.js |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ingest entry with content "The CoreMemoryManager uses AuthService for validation" on both | Entry ingested |
| 2 | Call `mem_map(action="get", entry_id=<new>)` on both | Identical structured map (entities, topic, sentiment) |
| 3 | Call `mem_map(action="search_entity", entity="CoreMemoryManager")` on both | Identical results |
| 4 | Call `mem_map(action="search_topic", topic="validation")` on both | Identical results |

**Test Data:** Content with known entities: "CoreMemoryManager", "AuthService"
**Postconditions:** Both have identical entity index

---

### TC-805: Kotlin Structured Map Parity with Node.js

| Field | Value |
|-------|-------|
| **ID** | TC-805 |
| **Priority** | Critical |
| **Type** | Parity |
| **Requirement** | BR-18, Story 3 AC-5 |
| **Preconditions** | Same entry content in both Kotlin and Node.js |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ingest identical entry on both | Entry ingested |
| 2 | Call `mem_map(action="reextract", entry_id=<new>)` on both | Identical structured maps |
| 3 | Call `mem_map(action="search_entity", entity="AuthService")` on both | Identical results |
| 4 | Verify entity extraction regex produces same entities | Same entity list |

**Test Data:** Content: "Decision: Use AuthService for token validation. The UserRepository handles persistence."
**Postconditions:** Both have identical structured maps and entity indexes

---

## 10. Requirements Traceability Matrix (RTM)

| Requirement | Source | Test Cases | Coverage |
|-------------|--------|------------|----------|
| UC-01 (Pin Entry) | FSD 3.1.2 | TC-001, TC-003, TC-004, TC-100, TC-101, TC-200, TC-201 | ✅ |
| UC-02 (Auto-Recall) | FSD 3.1.3 | TC-002, TC-102 | ✅ |
| UC-03 (Save Turn) | FSD 3.2.2 | TC-005, TC-006, TC-103, TC-104, TC-202, TC-203 | ✅ |
| UC-04 (Search Conversation) | FSD 3.2.3 | TC-007, TC-105 | ✅ |
| UC-05 (Search Entity) | FSD 3.3.2 | TC-008, TC-106, TC-205 | ✅ |
| UC-06 (Re-extract Map) | FSD 3.3.3 | TC-009, TC-206 | ✅ |
| UC-07 (Cache Hit) | FSD 3.4.2 | TC-010, TC-107, TC-108 | ✅ |
| UC-08 (Cache Invalidation) | FSD 3.4.3 | TC-311 | ✅ |
| UC-09 (File Watcher) | FSD 3.5.2 | TC-011, TC-109, TC-110, TC-208 | ✅ |
| UC-10 (Viewer Dashboard) | FSD 3.6.2 | TC-111, TC-211, TC-314, TC-318 | ✅ |
| UC-11 (Discover Child) | FSD 3.7.2 | TC-012, TC-112, TC-209 | ✅ |
| UC-12 (Propagate Tool Call) | FSD 3.7.3 | TC-210, TC-704 | ✅ |
| BR-01 (Budget 2000) | FSD 3.1.4 | TC-300, TC-101 | ✅ |
| BR-02 (Atomic persist) | FSD 3.1.4 | TC-301 | ✅ |
| BR-03 (Reorder) | FSD 3.1.4 | TC-302, TC-004 | ✅ |
| BR-04 (Ordered recall) | FSD 3.1.4 | TC-002 | ✅ |
| BR-05 (Summary tokens) | FSD 3.1.4 | TC-303 | ✅ |
| BR-06 (Node.js parity) | FSD 3.1.4 | TC-304, TC-800, TC-801 | ✅ |
| BR-07 (Session ID) | FSD 3.2.4 | TC-305, TC-103 | ✅ |
| BR-08 (Turn ordering) | FSD 3.2.4 | TC-306 | ✅ |
| BR-09 (Max 100 sessions) | FSD 3.2.4 | TC-104 | ✅ |
| BR-10 (Max 1000 turns) | FSD 3.2.4 | TC-104 | ✅ |
| BR-11 (FTS5 search) | FSD 3.2.4 | TC-307 | ✅ |
| BR-12 (Conversation parity) | FSD 3.2.4 | TC-802, TC-803 | ✅ |
| BR-13 (Regex extraction) | FSD 3.3.4 | TC-308 | ✅ |
| BR-14 (TF-IDF topics) | FSD 3.3.4 | TC-009 | ✅ |
| BR-15 (Auto-extract on ingest) | FSD 3.3.4 | TC-702 | ✅ |
| BR-16 (Case-insensitive) | FSD 3.3.4 | TC-309 | ✅ |
| BR-17 (Relevance ranking) | FSD 3.3.4 | TC-008 | ✅ |
| BR-18 (Map parity) | FSD 3.3.4 | TC-804, TC-805 | ✅ |
| BR-19 (LRU eviction) | FSD 3.4.4 | TC-310 | ✅ |
| BR-20 (Independent config) | FSD 3.4.4 | TC-312 | ✅ |
| BR-21 (Registry invalidation) | FSD 3.4.4 | TC-311 | ✅ |
| BR-22 (KB invalidation) | FSD 3.4.4 | TC-311 | ✅ |
| BR-23 (Code intel invalidation) | FSD 3.4.4 | TC-703 | ✅ |
| BR-24 (Default TTLs) | FSD 3.4.4 | TC-312 | ✅ |
| BR-25 (Default max_size) | FSD 3.4.4 | TC-310 | ✅ |
| BR-26 (Metrics logging) | FSD 3.4.4 | TC-010 | ✅ |
| BR-27 (Debounce 500ms) | FSD 3.5.3 | TC-313 | ✅ |
| BR-28 (Re-index < 2s) | FSD 3.5.3 | TC-603 | ✅ |
| BR-29 (Batch > 50) | FSD 3.5.3 | TC-110 | ✅ |
| BR-30 (Exclude patterns) | FSD 3.5.3 | TC-109 | ✅ |
| BR-31 (Graceful degradation) | FSD 3.5.3 | TC-208 | ✅ |
| BR-32 (chokidar) | FSD 3.5.3 | TC-011 | ✅ |
| BR-33 (Viewer disabled default) | FSD 3.6.3 | TC-111 | ✅ |
| BR-34 (Localhost only) | FSD 3.6.3 | TC-314 | ✅ |
| BR-35 (SSE updates) | FSD 3.6.3 | TC-318 | ✅ |
| BR-36 (Shared static files) | FSD 3.6.3 | TC-111 | ✅ |
| BR-37 (No auth) | FSD 3.6.3 | TC-314 | ✅ |
| BR-38 (Zero resource when disabled) | FSD 3.6.3 | TC-111 | ✅ |
| BR-39 (Tool prefix) | FSD 3.7.4 | TC-315 | ✅ |
| BR-40 (Health check 30s) | FSD 3.7.4 | TC-316 | ✅ |
| BR-41 (Exponential backoff) | FSD 3.7.4 | TC-316 | ✅ |
| BR-42 (Reconnect refresh) | FSD 3.7.4 | TC-012 | ✅ |
| BR-43 (Include all children) | FSD 3.7.4 | TC-012, TC-315 | ✅ |
| BR-44 (30s timeout) | FSD 3.7.4 | TC-317 | ✅ |
| BR-45 (Max 5 retries) | FSD 3.7.4 | TC-316 | ✅ |
| Story 1 AC-1 | BRD 2.3 | TC-001 | ✅ |
| Story 1 AC-2 | BRD 2.3 | TC-101, TC-300 | ✅ |
| Story 1 AC-3 | BRD 2.3 | TC-002 | ✅ |
| Story 1 AC-4 | BRD 2.3 | TC-003 | ✅ |
| Story 1 AC-5 | BRD 2.3 | TC-800, TC-801 | ✅ |
| Story 2 AC-1 | BRD 2.3 | TC-005 | ✅ |
| Story 2 AC-2 | BRD 2.3 | TC-006 | ✅ |
| Story 2 AC-3 | BRD 2.3 | TC-007 | ✅ |
| Story 2 AC-4 | BRD 2.3 | TC-007, TC-307 | ✅ |
| Story 2 AC-5 | BRD 2.3 | TC-802, TC-803 | ✅ |
| Story 3 AC-1 | BRD 2.3 | TC-008, TC-309 | ✅ |
| Story 3 AC-5 | BRD 2.3 | TC-804, TC-805 | ✅ |
| Story 4 AC-1 | BRD 2.3 | TC-010 | ✅ |
| Story 4 AC-3 | BRD 2.3 | TC-311 | ✅ |
| Story 4 AC-4 | BRD 2.3 | TC-310 | ✅ |
| Story 4 AC-5 | BRD 2.3 | TC-010 | ✅ |
| Story 5 AC-1 | BRD 2.3 | TC-011, TC-603 | ✅ |
| Story 5 AC-2 | BRD 2.3 | TC-110 | ✅ |
| Story 5 AC-3 | BRD 2.3 | TC-109 | ✅ |
| Story 5 AC-4 | BRD 2.3 | TC-208 | ✅ |
| Story 6 AC-3 | BRD 2.3 | TC-318 | ✅ |
| Story 6 AC-4 | BRD 2.3 | TC-111 | ✅ |
| Story 7 AC-1 | BRD 2.3 | TC-012, TC-315 | ✅ |
| Story 7 AC-2 | BRD 2.3 | TC-209, TC-316 | ✅ |
| Story 7 AC-3 | BRD 2.3 | TC-012 | ✅ |
| Story 7 AC-4 | BRD 2.3 | TC-012, TC-315 | ✅ |

**Coverage Summary:**

| Category | Total | Covered | Coverage % |
|----------|-------|---------|------------|
| Use Cases | 12 | 12 | 100% |
| Business Rules | 45 | 45 | 100% |
| Acceptance Criteria | 26 | 26 | 100% |
| FSD Test Scenarios (TC-01 to TC-26) | 26 | 26 | 100% |
| **Overall** | **109** | **109** | **100%** |

---

## 11. Appendix

### Test Data Setup Scripts

```sql
-- Seed knowledge entries for testing
INSERT INTO knowledge_entries (id, content, summary, type, tier, created_at)
VALUES
  (1, 'Architecture decision: use SQLite for all implementations', 'SQLite architecture decision', 'DECISION', 'SEMANTIC', datetime('now')),
  (2, 'The CoreMemoryManager handles pin/unpin operations', 'Core memory management', 'ARCHITECTURE', 'SEMANTIC', datetime('now')),
  (3, 'Authentication flow uses AuthService for token validation', 'Auth flow documentation', 'PROCEDURE', 'SEMANTIC', datetime('now')),
  (10, 'Entry 10 for pinning tests - short summary', 'Short summary 10', 'CONTEXT', 'WORKING', datetime('now')),
  (20, 'Entry 20 for pinning tests - medium summary content here', 'Medium summary 20', 'CONTEXT', 'WORKING', datetime('now')),
  (30, 'Entry 30 for pinning tests - longer summary content for budget testing purposes', 'Longer summary 30', 'CONTEXT', 'WORKING', datetime('now')),
  (42, 'Test entry 42 for pin/unpin operations', 'Test entry 42', 'CONTEXT', 'WORKING', datetime('now')),
  (99, 'Large entry 99 with many tokens in summary for budget overflow testing', 'This is a very long summary that contains approximately two hundred tokens worth of content to test the budget overflow scenario when pinning entries that would exceed the 2000 token maximum budget limit', 'CONTEXT', 'WORKING', datetime('now'));

-- Apply V3 schema if not already applied
ALTER TABLE knowledge_entries ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE knowledge_entries ADD COLUMN pin_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE knowledge_entries ADD COLUMN structured_map TEXT NOT NULL DEFAULT '{}';
```

### Parity Test Runner Configuration

```json
{
  "implementations": {
    "nodejs": { "command": "npx tsx src/index.ts", "transport": "stdio" },
    "python": { "command": "python -m mcp_code_intel", "transport": "stdio" },
    "kotlin": { "command": "java -jar mcp-code-intelligence-latest.jar", "transport": "stdio" }
  },
  "parity_tests": {
    "db_seed": "testdata/parity-seed.sql",
    "comparison": "json-deep-equal",
    "tolerance": {
      "timestamps": "ignore",
      "ordering": "sort-before-compare"
    }
  }
}
```

### Environment Configuration

- SQLite version: 3.35+ (required for FTS5 and JSON functions)
- Node.js: 20+ with TypeScript 5.x
- Python: 3.11+ with sqlite3 stdlib
- Kotlin: JVM 21, Kotlin 2.x, sqlite-jdbc
- All tests run locally (no external services required)
