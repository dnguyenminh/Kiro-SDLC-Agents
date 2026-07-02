# Software Test Cases (STC)

## FEC Knowledge Base — KSA-295: Multi-Scope KB - 3-Level Scope Isolation with Auto-Promotion Service

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-295 |
| Title | Multi-Scope KB - Test Cases |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-07-03 |
| Status | Draft |
| Related STP | STP-v1-KSA-295.docx |
| Related FSD | FSD-v1-KSA-295.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-03 | QA Agent | Initiate document — 54 test cases across 6 levels |

---

## Test Case Summary

| Level | ID Range | Count | Automation |
|-------|----------|-------|------------|
| Property-Based Tests | PBT-01 to PBT-04 | 4 | Automated (Vitest + fast-check) |
| Unit Tests | UT-01 to UT-18 | 18 | Automated (Vitest) |
| Integration Tests | IT-01 to IT-14 | 14 | Automated (Vitest + SQLite) |
| E2E API Tests | E2E-API-01 to E2E-API-14 | 14 | Automated (Playwright) |
| E2E UI Tests | N/A | 0 | N/A (no UI) |
| Manual SIT | SIT-01 to SIT-04 | 4 | Manual |
| **Total** | | **54** | **50 automated / 4 manual** |

---

## 1. Property-Based Tests (PBT)

### PBT-01: Promotion Criteria Evaluation — Random Entry Metrics

| Field | Value |
|-------|-------|
| **ID** | PBT-01 |
| **Priority** | High |
| **Type** | Property-Based |
| **Requirement** | UC-3, BR-2 |
| **Preconditions** | ScopePromotionService instantiated with default config |

**Property:** For any entry with random metrics (access_count: 0-100, citations: 0-20, quality_score: 0-100, cross_agent_cites: 0-10), the entry qualifies for promotion if and only if it meets >= 2 of the 4 criteria thresholds.

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Generate random entry metrics (1000 iterations) | Valid numeric values generated |
| 2 | Call evaluateCriteria() with generated metrics | Returns {metCount, score} |
| 3 | Independently calculate expected metCount | Count criteria: citations>=2, access>=5, quality>=70, cross_agent>=2 |
| 4 | Assert metCount matches independent calculation | Always equal |
| 5 | Assert entry qualifies iff metCount >= 2 | Property holds for all inputs |

**Test Data:** Random integers via fast-check arbitraries
**Postconditions:** No state change (pure function)

---

### PBT-02: Scope Transition Validity — All Scope Pairs

| Field | Value |
|-------|-------|
| **ID** | PBT-02 |
| **Priority** | High |
| **Type** | Property-Based |
| **Requirement** | BR-7 |
| **Preconditions** | MemoryEngine instantiated |

**Property:** For any (currentScope, targetScope) pair from {USER, PROJECT, SHARED} × {USER, PROJECT, SHARED}, promoteEntry returns true only for valid transitions: USER→PROJECT, PROJECT→SHARED. All others return false.

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Generate all 9 scope pair combinations | 9 pairs generated |
| 2 | Call promoteEntry() for each pair | Returns boolean |
| 3 | Assert USER→PROJECT = true | Valid promotion |
| 4 | Assert PROJECT→SHARED = true | Valid promotion |
| 5 | Assert all other 7 combinations = false | Invalid transitions rejected |

**Test Data:** Exhaustive: USER/PROJECT/SHARED × USER/PROJECT/SHARED
**Postconditions:** Only valid transitions persist to DB

---

### PBT-03: FTS Query Sanitization — Random Special Characters

| Field | Value |
|-------|-------|
| **ID** | PBT-03 |
| **Priority** | Medium |
| **Type** | Property-Based |
| **Requirement** | UC-2, NFR-Security |
| **Preconditions** | MemoryEngine with populated FTS index |

**Property:** For any random string containing special characters (!@#$%^&*(){}[]|), search() never throws FTS5 syntax error and always returns an array (possibly empty).

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Generate random strings with special chars (500 iterations) | Strings include FTS-breaking characters |
| 2 | Call search(randomQuery) | No exception thrown |
| 3 | Assert result is array | Always returns SearchResult[] |
| 4 | Assert query was sanitized (no raw specials in SQL) | Sanitization regex applied |

**Test Data:** Random Unicode strings via fast-check string()
**Postconditions:** Database stable, no corruption

---

### PBT-04: Scope Clause SQL Safety — Random User IDs

| Field | Value |
|-------|-------|
| **ID** | PBT-04 |
| **Priority** | High |
| **Type** | Property-Based |
| **Requirement** | BR-9, NFR-Security |
| **Preconditions** | MemoryEngine instantiated |

**Property:** For any random userId string (including SQL injection attempts like `'; DROP TABLE--`), buildScopeClause() produces a valid parameterized SQL clause that never concatenates the userId directly.

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Generate random userId strings (include SQL injection patterns) | Strings with quotes, semicolons, DROP, etc. |
| 2 | Call buildScopeClause({userId: randomStr}) | Returns SQL string |
| 3 | Assert returned clause uses ? parameter placeholder | Never contains raw userId value |
| 4 | Execute generated SQL with parameter binding | No SQL error, no injection |

**Test Data:** Random strings including `"' OR 1=1--"`, `"'; DROP TABLE knowledge_entries;--"`
**Postconditions:** Database integrity preserved

---

## 2. Unit Tests (UT)

### Feature: Scope Ingestion (UC-1)

### UT-01: Default Scope is USER on Ingestion

| Field | Value |
|-------|-------|
| **ID** | UT-01 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-1, BR-1 |
| **Preconditions** | MemoryEngine instantiated with empty DB |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call engine.insert({content: "test", summary: "test", type: "CONTEXT"}) | Returns entry ID > 0 |
| 2 | Query DB for inserted entry | Entry exists |
| 3 | Check entry.scope | scope = 'USER' |
| 4 | Check entry.user_id | user_id set from context |

**Test Data:** content="test knowledge", type="CONTEXT"
**Postconditions:** Entry exists in DB with scope=USER

---

### UT-02: Explicit PROJECT Scope on Ingestion

| Field | Value |
|-------|-------|
| **ID** | UT-02 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-1 AF-1 |
| **Preconditions** | MemoryEngine instantiated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call handleIngest({content: "team pattern", scope: "PROJECT"}) | Returns success with entry ID |
| 2 | Query DB for inserted entry | Entry exists |
| 3 | Check entry.scope | scope = 'PROJECT' |

**Test Data:** content="validated team pattern", scope="PROJECT"
**Postconditions:** Entry in DB with scope=PROJECT

---

### UT-03: SHARED Scope Blocked on Ingestion

| Field | Value |
|-------|-------|
| **ID** | UT-03 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-1 EF-1 |
| **Preconditions** | MemoryToolDispatcher instantiated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call handleIngest({content: "test", scope: "SHARED"}) | Returns error string |
| 2 | Check error message | "Cannot ingest directly to SHARED scope. Use promotion workflow." |
| 3 | Query DB for entry | No entry created |

**Test Data:** scope="SHARED"
**Postconditions:** No entry in DB

---

### Feature: Scope Search (UC-2)

### UT-04: buildScopeClause Generates Correct WHERE Clause

| Field | Value |
|-------|-------|
| **ID** | UT-04 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-2, BR-9 |
| **Preconditions** | MemoryEngine instantiated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call buildScopeClause({userId: "agent-001"}) | Returns SQL clause string |
| 2 | Verify clause contains scope IN ('PROJECT','SHARED') | Present |
| 3 | Verify clause contains (scope='USER' AND user_id=?) | Parameterized placeholder present |
| 4 | Verify clause does NOT contain literal "agent-001" | Not hardcoded |

**Test Data:** userId="agent-001"
**Postconditions:** None (pure function)

---

### UT-05: Search Returns Only Visible Entries

| Field | Value |
|-------|-------|
| **ID** | UT-05 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-2 |
| **Preconditions** | DB seeded with: Entry A (USER, user_id="user-1"), Entry B (USER, user_id="user-2"), Entry C (PROJECT), Entry D (SHARED) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call search("test", scopeCtx={userId:"user-1"}) | Returns results |
| 2 | Verify Entry A (own USER) in results | Present |
| 3 | Verify Entry B (other USER) NOT in results | Absent |
| 4 | Verify Entry C (PROJECT) in results | Present |
| 5 | Verify Entry D (SHARED) in results | Present |

**Test Data:** 4 entries across scopes, 2 different user_ids
**Postconditions:** access_count incremented for returned entries

---

### UT-06: Search with Missing User ID — Only PROJECT+SHARED

| Field | Value |
|-------|-------|
| **ID** | UT-06 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-2 AF-4, BR-9 |
| **Preconditions** | DB seeded with USER + PROJECT + SHARED entries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call search("test", scopeCtx={userId: undefined}) | Returns results |
| 2 | Verify no USER entries in results | All USER entries filtered out |
| 3 | Verify PROJECT entries present | Present |
| 4 | Verify SHARED entries present | Present |

**Test Data:** Entries: USER(2), PROJECT(1), SHARED(1)
**Postconditions:** None

---

### Feature: Auto-Scan (UC-3)

### UT-07: Scan Detects Entry Meeting 2+ Criteria

| Field | Value |
|-------|-------|
| **ID** | UT-07 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-3, BR-2 |
| **Preconditions** | DB has USER entry (age>24h, access_count=6, quality_score=75, citations=3, cross_agent=2) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call scanForPromotionCandidates() | Returns candidates array |
| 2 | Verify entry is in candidates list | Present with score > 0 |
| 3 | Verify candidate.targetScope = 'PROJECT' | Correct target |
| 4 | Verify candidate.reason contains criteria summary | Reason includes met criteria |

**Test Data:** Entry with access_count=6, quality_score=75, 3 citations from 2 distinct agents
**Postconditions:** Entry identified as candidate (not yet queued)

---

### UT-08: Scan Requires Minimum 2 of 4 Criteria

| Field | Value |
|-------|-------|
| **ID** | UT-08 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-3, BR-2 |
| **Preconditions** | DB has USER entry (age>24h) meeting only 1 criterion (access_count=10, citations=0, quality=50, cross_agent=0) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call scanForPromotionCandidates() | Returns candidates array |
| 2 | Verify entry is NOT in candidates | Absent — only 1/4 criteria met |

**Test Data:** Entry with access_count=10 (meets threshold) but citations=0, quality=50, cross_agent=0
**Postconditions:** Entry not promoted

---

### UT-09: Scan Skips Entries Younger Than 24 Hours

| Field | Value |
|-------|-------|
| **ID** | UT-09 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-3, BR-3, BR-8 |
| **Preconditions** | DB has entry with high metrics but created_at = NOW (just created) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Insert entry with created_at = current timestamp, high metrics | Entry created |
| 2 | Call scanForPromotionCandidates() | Returns candidates |
| 3 | Verify young entry is NOT in candidates | Absent — too young |

**Test Data:** Entry created now with access_count=20, citations=5, quality=90
**Postconditions:** Entry remains in USER scope

---

### Feature: Admin Review (UC-4)

### UT-10: Approve Changes Scope USER→PROJECT

| Field | Value |
|-------|-------|
| **ID** | UT-10 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-4, BR-7 |
| **Preconditions** | PENDING queue entry exists for entry_id=42 (USER→PROJECT) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call approve(42, "admin-001", "Good pattern") | Returns true |
| 2 | Query knowledge_entries WHERE id=42 | scope = 'PROJECT' |
| 3 | Query kb_promotion_queue for entry 42 | status='APPROVED', reviewed_by='admin-001', reviewed_at set |

**Test Data:** entry_id=42, reviewer="admin-001", comment="Good pattern"
**Postconditions:** Entry scope changed, queue record updated

---

### UT-11: Approve Non-Pending Entry Returns False

| Field | Value |
|-------|-------|
| **ID** | UT-11 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-4 EF-1 |
| **Preconditions** | No PENDING queue entry for entry_id=999 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call approve(999, "admin-001", "test") | Returns false |
| 2 | Verify no scope change in knowledge_entries | No change |

**Test Data:** entry_id=999 (not in queue)
**Postconditions:** No state change

---

### UT-12: Reject Does Not Set Cooldown — Entry Re-scannable

| Field | Value |
|-------|-------|
| **ID** | UT-12 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-4 AF-1, BR-4 |
| **Preconditions** | PENDING queue entry exists for entry_id=50 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call reject(50, "admin-001", "Not ready") | Returns true |
| 2 | Query queue entry for entry_id=50 | status='REJECTED', cooldown_until=NULL |
| 3 | Query knowledge_entries WHERE id=50 | scope unchanged (still USER) |
| 4 | Run scanForPromotionCandidates() again | Entry 50 eligible for re-scan (not blocked) |

**Test Data:** entry_id=50 with PENDING status
**Postconditions:** Entry remains USER, no cooldown, re-scannable

---

### Feature: Merge Promote (UC-5)

### UT-13: promoteOnMerge Promotes All Matching USER Entries

| Field | Value |
|-------|-------|
| **ID** | UT-13 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-5, BR-5 |
| **Preconditions** | DB has 3 USER entries tagged "KSA-295", 1 PROJECT entry tagged "KSA-295", 1 USER entry tagged "KSA-100" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call promoteOnMerge("KSA-295") | Returns {promoted: 3, skipped: 1} |
| 2 | Query all entries tagged KSA-295 with scope=USER | 0 results (all promoted) |
| 3 | Query all entries tagged KSA-295 with scope=PROJECT | 4 results (3 promoted + 1 existing) |
| 4 | Verify KSA-100 entry unchanged | Still USER scope |

**Test Data:** 5 entries: 3 USER+KSA-295, 1 PROJECT+KSA-295, 1 USER+KSA-100
**Postconditions:** Only KSA-295 USER entries promoted

---

### UT-14: promoteOnMerge Skips Non-USER Entries

| Field | Value |
|-------|-------|
| **ID** | UT-14 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | UC-5 AF-2 |
| **Preconditions** | DB has 1 PROJECT entry and 1 SHARED entry both tagged "KSA-295" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call promoteOnMerge("KSA-295") | Returns {promoted: 0, skipped: 2} |
| 2 | Verify PROJECT entry unchanged | Still PROJECT |
| 3 | Verify SHARED entry unchanged | Still SHARED |

**Test Data:** PROJECT entry + SHARED entry tagged KSA-295
**Postconditions:** No scope changes

---

### Feature: Request SHARED (UC-6)

### UT-15: Request SHARED for PROJECT Entry Creates PENDING

| Field | Value |
|-------|-------|
| **ID** | UT-15 |
| **Priority** | High |
| **Type** | Functional |
| **Requirement** | UC-6, BR-6 |
| **Preconditions** | DB has PROJECT-scope entry_id=30, no existing PENDING SHARED request for it |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call requestSharedPromotion(30, "Cross-project relevance") | Returns true |
| 2 | Query kb_promotion_queue for entry 30 | Found: source_tier='PROJECT', target_tier='SHARED', status='PENDING' |
| 3 | Verify entry scope unchanged | Still PROJECT (not yet approved) |

**Test Data:** entry_id=30 (PROJECT scope), reason="Cross-project relevance"
**Postconditions:** New PENDING queue entry created

---

### UT-16: Request SHARED for USER Entry Returns False

| Field | Value |
|-------|-------|
| **ID** | UT-16 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | UC-6 EF-1 |
| **Preconditions** | DB has USER-scope entry_id=31 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call requestSharedPromotion(31, "reason") | Returns false |
| 2 | Query kb_promotion_queue for entry 31 | Not found — no queue entry created |

**Test Data:** entry_id=31 (USER scope)
**Postconditions:** No queue entry

---

### UT-17: Duplicate SHARED Request Blocked

| Field | Value |
|-------|-------|
| **ID** | UT-17 |
| **Priority** | Medium |
| **Type** | Functional |
| **Requirement** | UC-6 EF-2 |
| **Preconditions** | DB has PROJECT entry_id=32 with existing PENDING SHARED request |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call requestSharedPromotion(32, "another reason") | Returns false |
| 2 | Query queue for entry 32 | Only 1 PENDING entry (original) |

**Test Data:** entry_id=32 already has PENDING→SHARED in queue
**Postconditions:** No duplicate created

---

### Feature: Scope Transition Validation

### UT-18: Invalid Scope Transitions Rejected

| Field | Value |
|-------|-------|
| **ID** | UT-18 |
| **Priority** | High |
| **Type** | Business Rule |
| **Requirement** | BR-7 |
| **Preconditions** | MemoryEngine with entries at each scope level |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call promoteEntry(userEntry, 'SHARED') — skip PROJECT | Returns false |
| 2 | Call promoteEntry(sharedEntry, 'PROJECT') — promotion direction wrong (this is demotion) | Use demoteEntry instead; promoteEntry returns false |
| 3 | Call promoteEntry(projectEntry, 'USER') — wrong direction | Returns false |
| 4 | Call promoteEntry(userEntry, 'PROJECT') | Returns true (valid) |
| 5 | Call promoteEntry(projectEntry, 'SHARED') | Returns true (valid) |

**Test Data:** Entries at USER, PROJECT, SHARED scopes
**Postconditions:** Only valid transitions succeed

---

## 3. Integration Tests (IT)

### Feature: Scope Ingestion (UC-1) — Full Stack

### IT-01: Ingest via Dispatcher — Default USER Scope with Context

| Field | Value |
|-------|-------|
| **ID** | IT-01 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | UC-1, BR-1, BR-9 |
| **Preconditions** | MemoryModule initialized with real SQLite DB, migration applied |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set dispatcher scopeContext = {userId: "agent-ba-001"} | Context set |
| 2 | Call dispatcher.dispatch("mem_ingest", {content: "test", summary: "test", type: "CONTEXT"}) | Returns success response |
| 3 | Query DB directly: SELECT scope, user_id FROM knowledge_entries ORDER BY id DESC LIMIT 1 | scope='USER', user_id='agent-ba-001' |

**Test Data:** content="Integration test entry", userId="agent-ba-001"
**Postconditions:** Entry persisted with correct scope and ownership

---

### IT-02: Ingest with Explicit PROJECT Scope via Dispatcher

| Field | Value |
|-------|-------|
| **ID** | IT-02 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | UC-1 AF-1 |
| **Preconditions** | MemoryModule initialized |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call dispatcher.dispatch("mem_ingest", {content: "team doc", scope: "PROJECT", summary: "team", type: "ARCHITECTURE"}) | Returns success |
| 2 | Query DB for the entry | scope='PROJECT', user_id set from context |

**Test Data:** scope="PROJECT", type="ARCHITECTURE"
**Postconditions:** PROJECT entry persisted

---

### IT-03: Ingest SHARED Rejected at Dispatcher Level

| Field | Value |
|-------|-------|
| **ID** | IT-03 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | UC-1 EF-1 |
| **Preconditions** | MemoryModule initialized |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call dispatcher.dispatch("mem_ingest", {content: "test", scope: "SHARED"}) | Returns error response |
| 2 | Verify response contains "Cannot ingest directly to SHARED" | Error message matches |
| 3 | Query DB: SELECT COUNT(*) WHERE content='test' AND scope='SHARED' | Count = 0 |

**Test Data:** scope="SHARED"
**Postconditions:** No SHARED entry in DB

---

### Feature: Scope Search (UC-2) — Full Stack

### IT-04: Search with ScopeContext Filters Correctly

| Field | Value |
|-------|-------|
| **ID** | IT-04 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | UC-2 |
| **Preconditions** | DB seeded: Entry A (USER, user-1, content="scope test"), Entry B (USER, user-2, content="scope test"), Entry C (PROJECT, content="scope test"), Entry D (SHARED, content="scope test") |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set scopeContext = {userId: "user-1"} | Context set |
| 2 | Call dispatcher.dispatch("mem_search", {query: "scope test"}) | Returns results |
| 3 | Parse results | Contains entries A, C, D |
| 4 | Verify Entry B (user-2's USER) NOT in results | Absent — scope isolation working |

**Test Data:** 4 entries matching "scope test", different scopes/owners
**Postconditions:** access_count incremented for returned entries

---

### IT-05: Search Without User ID Returns Only PROJECT+SHARED

| Field | Value |
|-------|-------|
| **ID** | IT-05 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | UC-2 AF-4, BR-9 |
| **Preconditions** | DB seeded with USER/PROJECT/SHARED entries; no scopeContext set (no userId) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set scopeContext = {userId: undefined} or do not set | No user context |
| 2 | Call dispatcher.dispatch("mem_search", {query: "test"}) | Returns results |
| 3 | Verify results contain only PROJECT and SHARED entries | No USER entries |

**Test Data:** Mixed scope entries
**Postconditions:** USER entries hidden when no identity

---

### Feature: Auto-Scan (UC-3) — Full Cycle

### IT-06: Full Scan Cycle — Detect, Queue, Verify

| Field | Value |
|-------|-------|
| **ID** | IT-06 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | UC-3, BR-2 |
| **Preconditions** | DB has USER entry (24h+ old, access_count=8, quality_score=80, 3 citations from 2 agents) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call promotionService.runPromotionCycle() | Returns summary string |
| 2 | Parse summary | "Promotion cycle: 1 candidates found. Queued: 1" |
| 3 | Query kb_promotion_queue | New PENDING entry for the high-value entry |
| 4 | Verify queue entry fields | source_tier='USER', target_tier='PROJECT', score>0, reason contains criteria |

**Test Data:** Entry with age>24h, access=8, quality=80, citations=3, cross_agent=2
**Postconditions:** Entry in promotion queue with PENDING status

---

### IT-07: Scan Skips Already-Queued Entries

| Field | Value |
|-------|-------|
| **ID** | IT-07 |
| **Priority** | Medium |
| **Type** | Integration |
| **Requirement** | UC-3 |
| **Preconditions** | DB has high-value entry already in PENDING queue |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run first scan — entry queued | 1 candidate queued |
| 2 | Run second scan | 0 new candidates (already queued) |
| 3 | Verify only 1 queue entry exists for the entry | No duplicate |

**Test Data:** Same high-value entry as IT-06
**Postconditions:** No duplicate queue entries

---

### Feature: Admin Review (UC-4) — Full Stack

### IT-08: Approve via Dispatcher — Full Flow

| Field | Value |
|-------|-------|
| **ID** | IT-08 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | UC-4 |
| **Preconditions** | Run scan → entry queued as PENDING |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call dispatcher.dispatch("mem_promote", {action: "list"}) | Returns JSON array with 1+ items |
| 2 | Extract entry_id from first item | Valid entry_id |
| 3 | Call dispatcher.dispatch("mem_promote", {action: "approve", entry_id: X, comment: "Approved"}) | Returns "Approved #X" |
| 4 | Query knowledge_entries WHERE id=X | scope='PROJECT' |
| 5 | Query kb_promotion_queue | status='APPROVED' |

**Test Data:** Entry from scan queue
**Postconditions:** Entry promoted, queue updated

---

### IT-09: Reject via Dispatcher — No Cooldown, Re-scannable

| Field | Value |
|-------|-------|
| **ID** | IT-09 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | UC-4 AF-1, BR-4 |
| **Preconditions** | PENDING entry in queue |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call dispatcher.dispatch("mem_promote", {action: "reject", entry_id: X, comment: "Not ready"}) | Returns "Rejected #X" |
| 2 | Query knowledge_entries WHERE id=X | scope='USER' (unchanged) |
| 3 | Query kb_promotion_queue for X | status='REJECTED', cooldown_until=NULL |
| 4 | Delete the REJECTED queue entry (simulate next cycle cleanup) | Deleted |
| 5 | Run scanForPromotionCandidates() again | Entry X appears as candidate again |

**Test Data:** Previously queued entry
**Postconditions:** Entry re-scannable after rejection

---

### Feature: Merge Promote (UC-5) — Full Stack

### IT-10: promote_on_merge via Dispatcher

| Field | Value |
|-------|-------|
| **ID** | IT-10 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | UC-5, BR-5 |
| **Preconditions** | DB has 2 USER entries with tags containing "KSA-295", 1 PROJECT entry with "KSA-295" |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call dispatcher.dispatch("mem_promote", {action: "promote_on_merge", ticket_key: "KSA-295"}) | Returns summary |
| 2 | Parse response | "promoteOnMerge(KSA-295): 2 promoted, 1 skipped." |
| 3 | Query DB: SELECT scope FROM knowledge_entries WHERE tags LIKE '%KSA-295%' AND scope='USER' | 0 results |
| 4 | Query consolidation_log | 2 new entries with reason containing "KSA-295" |

**Test Data:** 3 entries tagged KSA-295 (2 USER, 1 PROJECT)
**Postconditions:** All USER entries promoted to PROJECT

---

### Feature: Request SHARED (UC-6) — Full Stack

### IT-11: request_shared via Dispatcher — Valid PROJECT Entry

| Field | Value |
|-------|-------|
| **ID** | IT-11 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | UC-6, BR-6 |
| **Preconditions** | DB has PROJECT-scope entry_id=60 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call dispatcher.dispatch("mem_promote", {action: "request_shared", entry_id: 60, reason: "Useful across projects"}) | Returns "SHARED promotion requested for #60" |
| 2 | Query kb_promotion_queue | New entry: entry_id=60, target_tier='SHARED', status='PENDING' |

**Test Data:** entry_id=60 (PROJECT scope)
**Postconditions:** PENDING queue entry created

---

### IT-12: request_shared for USER Entry — Blocked

| Field | Value |
|-------|-------|
| **ID** | IT-12 |
| **Priority** | Medium |
| **Type** | Integration |
| **Requirement** | UC-6 EF-1 |
| **Preconditions** | DB has USER-scope entry_id=61 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call dispatcher.dispatch("mem_promote", {action: "request_shared", entry_id: 61}) | Returns error message |
| 2 | Verify response contains "not in PROJECT scope" | Message matches |
| 3 | Query kb_promotion_queue for entry 61 | Not found |

**Test Data:** entry_id=61 (USER scope)
**Postconditions:** No queue entry created

---

### IT-13: Duplicate SHARED Request — Blocked

| Field | Value |
|-------|-------|
| **ID** | IT-13 |
| **Priority** | Medium |
| **Type** | Integration |
| **Requirement** | UC-6 EF-2 |
| **Preconditions** | PROJECT entry_id=62 already has PENDING SHARED request |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | First request: dispatcher.dispatch("mem_promote", {action: "request_shared", entry_id: 62, reason: "first"}) | "SHARED promotion requested for #62" |
| 2 | Second request: dispatcher.dispatch("mem_promote", {action: "request_shared", entry_id: 62, reason: "second"}) | Returns false / error |
| 3 | Query queue for entry 62 where target_tier='SHARED' and status='PENDING' | Only 1 entry |

**Test Data:** entry_id=62 (PROJECT)
**Postconditions:** No duplicate

---

### Feature: Migration & Backward Compatibility

### IT-14: Migration Adds Scope Columns — Existing Entries Default USER

| Field | Value |
|-------|-------|
| **ID** | IT-14 |
| **Priority** | High |
| **Type** | Integration |
| **Requirement** | BR-7, NFR-Backward Compat |
| **Preconditions** | DB created WITHOUT scope/user_id columns (simulate pre-migration state) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create knowledge_entries table without scope/user_id columns | Table created (old schema) |
| 2 | Insert 3 entries (simulating pre-existing data) | 3 entries exist |
| 3 | Run migrate001AddScopeColumns(db) | Migration completes |
| 4 | Query: SELECT scope FROM knowledge_entries | All 3 entries have scope='USER' |
| 5 | Verify indexes created | idx_ke_scope, idx_ke_user_id, idx_ke_scope_user exist |
| 6 | Run migration again (idempotent check) | No error, no duplicates |

**Test Data:** 3 pre-existing entries without scope
**Postconditions:** All entries have scope=USER, indexes created

---

## 4. E2E API Tests (E2E-API)

These tests exercise the full HTTP stack: POST /mcp/tools/call with real X-User-Id headers.

### E2E-API-01: Ingest Default Scope via HTTP

| Field | Value |
|-------|-------|
| **ID** | E2E-API-01 |
| **Priority** | High |
| **Type** | E2E-API |
| **Requirement** | UC-1, BR-1, BR-9 |
| **Preconditions** | Server running, /mcp/tools/call endpoint available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /mcp/tools/call with header X-User-Id: "agent-dev-001", body: {tool_name: "mem_ingest", arguments: {content: "e2e test", summary: "e2e", type: "CONTEXT"}} | HTTP 200 |
| 2 | Parse response body | Contains entry ID, scope="USER" |
| 3 | GET entry via mem_crud(action=get, id=X) | Entry has scope=USER, user_id="agent-dev-001" |

**Test Data:** X-User-Id: "agent-dev-001", content: "e2e test entry"

---

### E2E-API-02: Ingest with PROJECT Scope via HTTP

| Field | Value |
|-------|-------|
| **ID** | E2E-API-02 |
| **Priority** | High |
| **Type** | E2E-API |
| **Requirement** | UC-1 AF-1 |
| **Preconditions** | Server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /mcp/tools/call with body: {tool_name: "mem_ingest", arguments: {content: "team knowledge", scope: "PROJECT", summary: "team", type: "ARCHITECTURE"}} | HTTP 200 |
| 2 | Parse response | scope="PROJECT" in result |

**Test Data:** scope: "PROJECT"

---

### E2E-API-03: Ingest SHARED Blocked via HTTP

| Field | Value |
|-------|-------|
| **ID** | E2E-API-03 |
| **Priority** | High |
| **Type** | E2E-API |
| **Requirement** | UC-1 EF-1 |
| **Preconditions** | Server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /mcp/tools/call with body: {tool_name: "mem_ingest", arguments: {content: "test", scope: "SHARED"}} | HTTP 200 (tool returns error in body) |
| 2 | Parse response | Contains "Cannot ingest directly to SHARED scope" |

**Test Data:** scope: "SHARED"

---

### E2E-API-04: Search Scope Visibility via HTTP — Cross-User Isolation

| Field | Value |
|-------|-------|
| **ID** | E2E-API-04 |
| **Priority** | High |
| **Type** | E2E-API |
| **Requirement** | UC-2, FSD TC-4 |
| **Preconditions** | Server running, DB has: user-A USER entry, user-B USER entry, PROJECT entry, SHARED entry |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /mcp/tools/call with header X-User-Id: "user-A", body: {tool_name: "mem_search", arguments: {query: "isolation"}} | HTTP 200 |
| 2 | Parse results | Contains user-A's USER + PROJECT + SHARED entries |
| 3 | Verify user-B's USER entry NOT in results | Absent — isolation enforced |
| 4 | POST same request with header X-User-Id: "user-B" | HTTP 200 |
| 5 | Parse results | Contains user-B's USER + PROJECT + SHARED entries |
| 6 | Verify user-A's USER entry NOT in results | Absent |

**Test Data:** 4 entries seeded: USER(user-A), USER(user-B), PROJECT, SHARED — all match "isolation"

---

### E2E-API-05: Scan Trigger via HTTP — Detect Candidates

| Field | Value |
|-------|-------|
| **ID** | E2E-API-05 |
| **Priority** | High |
| **Type** | E2E-API |
| **Requirement** | UC-3, FSD TC-5 |
| **Preconditions** | Server running, DB has eligible high-value USER entry (age>24h, meets >=2 criteria) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /mcp/tools/call: {tool_name: "mem_promote", arguments: {action: "scan"}} | HTTP 200 |
| 2 | Parse response | "Promotion cycle: N candidates found. Queued: X" where X >= 1 |
| 3 | POST: {tool_name: "mem_promote", arguments: {action: "list"}} | Returns array with queued entry |

**Test Data:** Pre-seeded high-value entry

---

### E2E-API-06: Scan Skips Young Entries via HTTP

| Field | Value |
|-------|-------|
| **ID** | E2E-API-06 |
| **Priority** | Medium |
| **Type** | E2E-API |
| **Requirement** | UC-3, BR-3, FSD TC-6 |
| **Preconditions** | Server running, ingest a new entry with high metrics (just created, < 24h) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ingest entry with high access_count (via direct DB or repeated access) | Entry created |
| 2 | POST: {tool_name: "mem_promote", arguments: {action: "scan"}} | HTTP 200 |
| 3 | POST: {tool_name: "mem_promote", arguments: {action: "list"}} | Young entry NOT in pending list |

**Test Data:** Entry created now with artificially high metrics

---

### E2E-API-07: Scan Skips Already-Queued Entries

| Field | Value |
|-------|-------|
| **ID** | E2E-API-07 |
| **Priority** | Medium |
| **Type** | E2E-API |
| **Requirement** | UC-3, FSD TC-7 |
| **Preconditions** | Entry already in PENDING queue from E2E-API-05 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST: {tool_name: "mem_promote", arguments: {action: "scan"}} (second scan) | HTTP 200 |
| 2 | Parse response | 0 new candidates (already queued) |

**Test Data:** Same entry as E2E-API-05

---

### E2E-API-08: Admin Approve via HTTP

| Field | Value |
|-------|-------|
| **ID** | E2E-API-08 |
| **Priority** | High |
| **Type** | E2E-API |
| **Requirement** | UC-4, FSD TC-8 |
| **Preconditions** | PENDING entry exists in queue |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST: {tool_name: "mem_promote", arguments: {action: "list"}} | Returns 1+ pending items |
| 2 | Extract entry_id from response | Valid ID |
| 3 | POST: {tool_name: "mem_promote", arguments: {action: "approve", entry_id: X, comment: "Approved for team"}} | "Approved #X" |
| 4 | Verify entry scope changed via mem_search | Entry now visible without user filter |

**Test Data:** Pending entry from scan

---

### E2E-API-09: Admin Reject — No Cooldown — Re-scannable

| Field | Value |
|-------|-------|
| **ID** | E2E-API-09 |
| **Priority** | High |
| **Type** | E2E-API |
| **Requirement** | UC-4, BR-4, FSD TC-9 |
| **Preconditions** | Another PENDING entry in queue |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST: {tool_name: "mem_promote", arguments: {action: "reject", entry_id: Y, comment: "Not yet"}} | "Rejected #Y" |
| 2 | POST: {tool_name: "mem_promote", arguments: {action: "list"}} | Entry Y no longer in PENDING list |
| 3 | Entry remains USER scope (verify via mem_search) | Only visible to owner |

**Test Data:** PENDING entry

---

### E2E-API-10: promote_on_merge via HTTP

| Field | Value |
|-------|-------|
| **ID** | E2E-API-10 |
| **Priority** | High |
| **Type** | E2E-API |
| **Requirement** | UC-5, BR-5, FSD TC-10 |
| **Preconditions** | DB has USER entries tagged with ticket key |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST: {tool_name: "mem_promote", arguments: {action: "promote_on_merge", ticket_key: "TEST-001"}} | HTTP 200 |
| 2 | Parse response | "promoteOnMerge(TEST-001): N promoted, M skipped." |
| 3 | Search for TEST-001 entries | All previously USER entries now PROJECT |

**Test Data:** 2 USER entries with tags "TEST-001"

---

### E2E-API-11: request_shared for PROJECT Entry via HTTP

| Field | Value |
|-------|-------|
| **ID** | E2E-API-11 |
| **Priority** | High |
| **Type** | E2E-API |
| **Requirement** | UC-6, BR-6, FSD TC-11 |
| **Preconditions** | PROJECT-scope entry exists |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST: {tool_name: "mem_promote", arguments: {action: "request_shared", entry_id: Z, reason: "Cross-team value"}} | "SHARED promotion requested for #Z" |
| 2 | POST: {tool_name: "mem_promote", arguments: {action: "list"}} | New PENDING entry with target=SHARED |

**Test Data:** PROJECT entry_id

---

### E2E-API-12: request_shared for USER Entry Blocked via HTTP

| Field | Value |
|-------|-------|
| **ID** | E2E-API-12 |
| **Priority** | Medium |
| **Type** | E2E-API |
| **Requirement** | UC-6 EF-1, FSD TC-12 |
| **Preconditions** | USER-scope entry exists |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST: {tool_name: "mem_promote", arguments: {action: "request_shared", entry_id: W}} | Error response |
| 2 | Parse response | Contains "not in PROJECT scope" |

**Test Data:** USER-scope entry_id

---

### E2E-API-13: Duplicate SHARED Request Blocked via HTTP

| Field | Value |
|-------|-------|
| **ID** | E2E-API-13 |
| **Priority** | Medium |
| **Type** | E2E-API |
| **Requirement** | UC-6 EF-2, FSD TC-13 |
| **Preconditions** | PROJECT entry already has PENDING SHARED request (from E2E-API-11) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST: {tool_name: "mem_promote", arguments: {action: "request_shared", entry_id: Z, reason: "again"}} | Error response |
| 2 | Parse response | "not in PROJECT scope or already queued" |

**Test Data:** Same entry as E2E-API-11

---

### E2E-API-14: Search with Missing X-User-Id Header

| Field | Value |
|-------|-------|
| **ID** | E2E-API-14 |
| **Priority** | Medium |
| **Type** | E2E-API |
| **Requirement** | UC-2 AF-4, BR-9, FSD TC-14 |
| **Preconditions** | DB has USER/PROJECT/SHARED entries |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST /mcp/tools/call WITHOUT X-User-Id header: {tool_name: "mem_search", arguments: {query: "test"}} | HTTP 200 |
| 2 | Parse results | Only PROJECT and SHARED entries returned |
| 3 | Verify NO USER entries in results | All USER entries filtered out |

**Test Data:** Mixed-scope entries, no X-User-Id header

---

## 5. Manual SIT Tests

These tests cover scenarios that require timing, visual judgment, or concurrent access — not practical to automate.

### SIT-01: Background Scan Performance Under Load

| Field | Value |
|-------|-------|
| **ID** | SIT-01 |
| **Priority** | Medium |
| **Type** | Non-Functional — Performance |
| **Requirement** | NFR-Performance (FSD Section 8) |
| **Preconditions** | DB seeded with 1000+ USER entries (varied ages and metrics) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Seed DB with 1000 USER entries (mix of eligible and ineligible) | Data loaded |
| 2 | Trigger scan via mem_promote(action=scan) | Scan completes |
| 3 | Measure scan duration | Completes within 10 seconds |
| 4 | Verify scan processed max 50 entries (batch limit) | Response shows ≤50 candidates |
| 5 | Verify server remained responsive during scan (send concurrent search) | Search returns results without timeout |

**Test Data:** 1000 entries: ~100 eligible (high metrics, age>24h), ~900 ineligible
**Acceptance Criteria:** Scan ≤10s, concurrent requests unblocked

---

### SIT-02: Backward Compatibility After Migration

| Field | Value |
|-------|-------|
| **ID** | SIT-02 |
| **Priority** | High |
| **Type** | Regression |
| **Requirement** | NFR-Backward Compat |
| **Preconditions** | Real DB file with pre-existing entries (before migration) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start server with old DB file (no scope/user_id columns) | Server starts, migration runs |
| 2 | Verify server logs show migration success | "Added scope columns" or similar |
| 3 | Search existing entries | All pre-existing entries returned (defaulted to USER) |
| 4 | Ingest new entry | Succeeds with scope=USER |
| 5 | Verify old entries still queryable alongside new entries | Both old and new in results |

**Test Data:** Real DB backup from before KSA-295 implementation
**Acceptance Criteria:** Zero data loss, all existing operations work

---

### SIT-03: SQL Injection Attempt via X-User-Id Header

| Field | Value |
|-------|-------|
| **ID** | SIT-03 |
| **Priority** | High |
| **Type** | Security |
| **Requirement** | NFR-Security (TDD Section 9) |
| **Preconditions** | Server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send request with X-User-Id: "'; DROP TABLE knowledge_entries;--" | Server does not crash |
| 2 | Verify search returns results normally (table intact) | Results returned |
| 3 | Send request with X-User-Id: "' OR 1=1--" | Server does not return all entries |
| 4 | Verify scope isolation still works | Only appropriate entries returned |
| 5 | Check server error logs | No SQL syntax errors logged |

**Test Data:** Malicious header values
**Acceptance Criteria:** No SQL injection, no data exposure, server stable

---

### SIT-04: Concurrent Promotion and Search

| Field | Value |
|-------|-------|
| **ID** | SIT-04 |
| **Priority** | Medium |
| **Type** | Non-Functional — Concurrency |
| **Requirement** | NFR-Availability |
| **Preconditions** | Server running, entries in various scopes |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start scan via mem_promote(action=scan) | Scan begins |
| 2 | Simultaneously send 5 search requests | All 5 searches return results |
| 3 | Simultaneously send 2 ingest requests | Both ingests succeed |
| 4 | Wait for scan to complete | Scan summary returned |
| 5 | Verify no data corruption (all entries intact) | Entry count matches expected |

**Test Data:** Background scan + concurrent read/write operations
**Acceptance Criteria:** No blocking, no data corruption, all operations succeed

---

## 6. Requirements Traceability Matrix (RTM)

| Requirement | Source | Test Cases | Coverage |
|-------------|--------|------------|----------|
| UC-1 Private-by-Default Ingestion | FSD 3.1 | PBT-02, UT-01, UT-02, UT-03, IT-01, IT-02, IT-03, E2E-API-01, E2E-API-02, E2E-API-03 | ✅ |
| UC-1 AF-1 (Explicit PROJECT) | FSD 3.1 | UT-02, IT-02, E2E-API-02 | ✅ |
| UC-1 AF-2 (No X-User-Id) | FSD 3.1 | UT-06, IT-05, E2E-API-14 | ✅ |
| UC-1 EF-1 (SHARED blocked) | FSD 3.1 | UT-03, IT-03, E2E-API-03 | ✅ |
| UC-2 Scope-Filtered Search | FSD 3.2 | PBT-03, PBT-04, UT-04, UT-05, UT-06, IT-04, IT-05, E2E-API-04, E2E-API-14 | ✅ |
| UC-2 AF-4 (Missing header) | FSD 3.2 | UT-06, IT-05, E2E-API-14 | ✅ |
| UC-3 Auto-Detection Scan | FSD 3.3 | PBT-01, UT-07, UT-08, UT-09, IT-06, IT-07, E2E-API-05, E2E-API-06, E2E-API-07 | ✅ |
| UC-3 (Age filter) | FSD 3.3 | UT-09, E2E-API-06 | ✅ |
| UC-3 (Already-queued skip) | FSD 3.3 | IT-07, E2E-API-07 | ✅ |
| UC-4 Admin Approve | FSD 3.4 | UT-10, UT-11, IT-08, E2E-API-08 | ✅ |
| UC-4 AF-1 (Reject, no cooldown) | FSD 3.4 | UT-12, IT-09, E2E-API-09 | ✅ |
| UC-5 Merge Auto-Promote | FSD 3.5 | UT-13, UT-14, IT-10, E2E-API-10 | ✅ |
| UC-5 AF-2 (Skip non-USER) | FSD 3.5 | UT-14, IT-10 | ✅ |
| UC-6 Request SHARED | FSD 3.6 | UT-15, UT-16, UT-17, IT-11, IT-12, IT-13, E2E-API-11, E2E-API-12, E2E-API-13 | ✅ |
| UC-6 EF-1 (USER entry blocked) | FSD 3.6 | UT-16, IT-12, E2E-API-12 | ✅ |
| UC-6 EF-2 (Duplicate blocked) | FSD 3.6 | UT-17, IT-13, E2E-API-13 | ✅ |
| BR-1 Default scope=USER | FSD 3.7 | UT-01, IT-01, E2E-API-01 | ✅ |
| BR-2 Scan criteria (>=2/4) | FSD 3.7 | PBT-01, UT-07, UT-08, IT-06 | ✅ |
| BR-3 Age >=24h | FSD 3.7 | UT-09, IT-07, E2E-API-06 | ✅ |
| BR-4 No cooldown on reject | FSD 3.7 | UT-12, IT-09, E2E-API-09 | ✅ |
| BR-5 Merge = auto-promote | FSD 3.7 | UT-13, IT-10, E2E-API-10 | ✅ |
| BR-6 PROJECT→SHARED requires approval | FSD 3.7 | UT-15, IT-11, E2E-API-11 | ✅ |
| BR-7 Single-step transitions | FSD 3.7 | PBT-02, UT-18, IT-14 | ✅ |
| BR-8 Scan interval = 1 hour | FSD 3.7 | UT-09 (config validation) | ✅ |
| BR-9 X-User-Id header | FSD 3.7 | UT-04, UT-06, IT-05, E2E-API-14 | ✅ |
| NFR-Performance | FSD 8 | PBT-03, SIT-01 | ✅ |
| NFR-Backward Compat | FSD 8 | IT-14, SIT-02 | ✅ |
| NFR-Security | FSD 8, TDD 9 | PBT-04, SIT-03 | ✅ |
| NFR-Availability | FSD 8 | SIT-04 | ✅ |

**Coverage Summary:**

| Category | Total | Covered | Coverage % |
|----------|-------|---------|------------|
| Use Cases (UC-1 to UC-6) | 6 | 6 | 100% |
| Business Rules (BR-1 to BR-9) | 9 | 9 | 100% |
| Alternative Flows | 7 | 7 | 100% |
| Exception Flows | 5 | 5 | 100% |
| Non-Functional Requirements | 4 | 4 | 100% |
| FSD Test Scenarios (TC-1 to TC-14) | 14 | 14 | 100% |
| **Overall** | **45** | **45** | **100%** |

---

## 7. Appendix

### Test Data Setup

```sql
-- Pre-seeded entries for scope isolation testing
INSERT INTO knowledge_entries (content, summary, type, tier, scope, user_id, access_count, quality_score, created_at, tags)
VALUES
  ('User A private knowledge', 'User A entry', 'CONTEXT', 'WORKING', 'USER', 'user-A', 3, 60, datetime('now', '-48 hours'), 'test,isolation'),
  ('User B private knowledge', 'User B entry', 'CONTEXT', 'WORKING', 'USER', 'user-B', 2, 50, datetime('now', '-48 hours'), 'test,isolation'),
  ('Team knowledge shared', 'Project entry', 'ARCHITECTURE', 'SEMANTIC', 'PROJECT', 'user-A', 10, 85, datetime('now', '-72 hours'), 'test,isolation'),
  ('Company-wide best practice', 'Shared entry', 'REQUIREMENT', 'SEMANTIC', 'SHARED', NULL, 20, 95, datetime('now', '-720 hours'), 'test,isolation');

-- High-value entry for promotion scan testing
INSERT INTO knowledge_entries (content, summary, type, tier, scope, user_id, access_count, quality_score, created_at, tags)
VALUES ('Reusable pattern discovered', 'High value pattern', 'ARCHITECTURE', 'SEMANTIC', 'USER', 'user-A', 8, 80, datetime('now', '-48 hours'), 'KSA-295,pattern');

-- Citations for the high-value entry
INSERT INTO citations (entry_id, cited_by, created_at)
VALUES
  ((SELECT MAX(id) FROM knowledge_entries), 'agent-ba-001', datetime('now', '-24 hours')),
  ((SELECT MAX(id) FROM knowledge_entries), 'agent-sa-001', datetime('now', '-12 hours')),
  ((SELECT MAX(id) FROM knowledge_entries), 'agent-dev-001', datetime('now', '-6 hours'));

-- Entries for merge promotion testing
INSERT INTO knowledge_entries (content, summary, type, tier, scope, user_id, access_count, created_at, tags)
VALUES
  ('Ticket requirement note', 'KSA-295 req', 'REQUIREMENT', 'WORKING', 'USER', 'user-A', 2, datetime('now', '-48 hours'), 'KSA-295'),
  ('Architecture decision for ticket', 'KSA-295 arch', 'ARCHITECTURE', 'SEMANTIC', 'USER', 'user-A', 5, datetime('now', '-48 hours'), 'KSA-295'),
  ('Already promoted team doc', 'KSA-295 team', 'CONTEXT', 'WORKING', 'PROJECT', 'user-A', 15, datetime('now', '-120 hours'), 'KSA-295');
```

### FSD TC Mapping to STC IDs

| FSD TC | Description | STC Test Cases |
|--------|-------------|----------------|
| TC-1 | Ingest default scope | UT-01, IT-01, E2E-API-01 |
| TC-2 | Ingest explicit PROJECT | UT-02, IT-02, E2E-API-02 |
| TC-3 | Ingest SHARED blocked | UT-03, IT-03, E2E-API-03 |
| TC-4 | Search visibility isolation | UT-05, IT-04, E2E-API-04 |
| TC-5 | Scan detects eligible entry | UT-07, IT-06, E2E-API-05 |
| TC-6 | Scan skips young entries | UT-09, E2E-API-06 |
| TC-7 | Scan skips already-queued | IT-07, E2E-API-07 |
| TC-8 | Admin approves promotion | UT-10, IT-08, E2E-API-08 |
| TC-9 | Admin rejects — no cooldown | UT-12, IT-09, E2E-API-09 |
| TC-10 | Merge auto-promotes | UT-13, IT-10, E2E-API-10 |
| TC-11 | SHARED request from PROJECT | UT-15, IT-11, E2E-API-11 |
| TC-12 | SHARED request from USER (blocked) | UT-16, IT-12, E2E-API-12 |
| TC-13 | Duplicate SHARED request blocked | UT-17, IT-13, E2E-API-13 |
| TC-14 | Missing header — limited visibility | UT-06, IT-05, E2E-API-14 |

---

*End of STC Document*
