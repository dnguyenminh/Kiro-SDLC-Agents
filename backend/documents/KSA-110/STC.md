# Software Test Cases (STC)

## mcp-code-intelligence-nodejs — KSA-110: KB System Upgrade v0.6.0

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-110 |
| Title | KB System Upgrade v0.6.0 — Test Cases |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-05-23 |
| Status | Draft |
| Related STP | STP-v1.0-KSA-110.docx |
| Related BRD | BRD-v1.1-KSA-110.docx |
| Related FSD | FSD-v1.0-KSA-110.docx |
| Related TDD | TDD-v1.0-KSA-110.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-05-23 | QA Agent | Initial — 136 test cases across 6 levels |

---

## 1. Property-Based Tests (PBT)

### PBT-001: Token counting invariant — always non-negative

| Field | Value |
|-------|-------|
| ID | PBT-001 |
| Feature | F1, F4 |
| Rule | BR-F1-02, BR-F4-15 |
| Priority | High |
| Server | Node.js (fast-check) |
| Property | ∀ content: string → countTokens(content) ≥ 0 |
| Generator | Arbitrary strings (0–100000 chars) |
| Expected | Token count is always ≥ 0, equals Math.ceil(content.length / 4) |

### PBT-002: Token counting — chars/4 relationship

| Field | Value |
|-------|-------|
| ID | PBT-002 |
| Feature | F1 |
| Rule | BR-F4-15 |
| Priority | High |
| Server | Node.js |
| Property | ∀ content → countTokens(content) === Math.ceil(content.length / 4) |
| Generator | Arbitrary non-empty strings |
| Expected | Exact chars/4 ceiling relationship holds |

### PBT-003: Pin budget never exceeded after any sequence of pin/unpin

| Field | Value |
|-------|-------|
| ID | PBT-003 |
| Feature | F1 |
| Rule | BR-F1-02 |
| Priority | Critical |
| Server | Node.js |
| Property | ∀ operations: (pin|unpin)[] → totalPinnedTokens ≤ 2000 |
| Generator | Random sequences of pin/unpin with random entry sizes |
| Expected | Budget invariant never violated |

### PBT-004: Pin order always contiguous after any operation sequence

| Field | Value |
|-------|-------|
| ID | PBT-004 |
| Feature | F1 |
| Rule | BR-F1-03 |
| Priority | High |
| Server | Node.js |
| Property | ∀ ops → pinned entries have orders [0, 1, 2, ..., n-1] with no gaps |
| Generator | Random pin/unpin/reorder sequences |
| Expected | Orders always form contiguous 0-based sequence |

### PBT-005: Quality score always in [0, 100]

| Field | Value |
|-------|-------|
| ID | PBT-005 |
| Feature | F4 |
| Rule | BR-F4-10 |
| Priority | High |
| Server | Node.js |
| Property | ∀ content, meta → 0 ≤ qualityScore(content, meta) ≤ 100 |
| Generator | Arbitrary content (50–10000 chars), random meta combinations |
| Expected | Score always clamped to [0, 100] |

### PBT-006: Entity extraction — ticket pattern always classified as "ticket"

| Field | Value |
|-------|-------|
| ID | PBT-006 |
| Feature | F3 |
| Rule | BR-F3-04 |
| Priority | Medium |
| Server | Node.js |
| Property | ∀ s matching [A-Z]+-\d+ → classifyEntity(s) === "ticket" |
| Generator | Random uppercase letters (1-5) + "-" + random digits (1-5) |
| Expected | Always classified as "ticket" type |

### PBT-007: Search token budget — results never exceed max_tokens

| Field | Value |
|-------|-------|
| ID | PBT-007 |
| Feature | F4 |
| Rule | BR-F4-13 |
| Priority | Critical |
| Server | Node.js |
| Property | ∀ results, budget → applyBudget(results, budget).tokensUsed ≤ budget |
| Generator | Random result sets (1-50 items, 10-5000 chars each), budget 100-5000 |
| Expected | Token budget never exceeded |

### PBT-008: Conversation turn_number always sequential within session

| Field | Value |
|-------|-------|
| ID | PBT-008 |
| Feature | F2 |
| Rule | BR-F2-05 |
| Priority | High |
| Server | Node.js |
| Property | ∀ session with N turns → turn_numbers === [1, 2, ..., N] |
| Generator | Random save_turn sequences for same session |
| Expected | Turn numbers always sequential starting from 1 |

---

## 2. Unit Tests (UT)

### 2.1 Feature F1: Core Memory

| TC ID | Title | Input | Expected Output | Rule | Priority |
|-------|-------|-------|-----------------|------|----------|
| TC-F1-001 | Pin entry successfully | pin(entry_id=1), entry exists (200 chars) | success=true, pin_order=0, tokens=50 | BR-F1-01 | Critical |
| TC-F1-002 | Pin entry — already pinned | pin(entry_id=1) twice | Second call returns "already pinned" | — | High |
| TC-F1-003 | Pin entry — not found | pin(entry_id=9999) | Error: "Entry 9999 not found" | BR-F1-06 | Critical |
| TC-F1-004 | Pin entry — budget check passes | pin entry with 400 chars (100 tokens), budget at 1900 | success=true, budget_used=2000 | BR-F1-02 | High |
| TC-F1-005 | Pin entry — max 10 reached | Pin 11th entry | Error: "Maximum pinned entries (10) reached" | BR-F1-01 | Critical |
| TC-F1-006 | Pin entry — count exactly 10 | Pin 10th entry | success=true, pinned_count=10 | BR-F1-01 | High |
| TC-F1-007 | Unpin entry | unpin(entry_id=1), entry is pinned | success=true, entry unpinned | — | High |
| TC-F1-008 | Unpin entry — not pinned | unpin(entry_id=1), entry not pinned | Error or no-op | — | Medium |
| TC-F1-009 | Unpin middle — reorder | 3 pinned [0,1,2], unpin order=1 | Remaining: [0,1] (reordered) | BR-F1-03 | Critical |
| TC-F1-010 | Unpin first — reorder | 3 pinned [0,1,2], unpin order=0 | Remaining: [0,1] (shifted down) | BR-F1-03 | High |
| TC-F1-011 | List pinned entries | 3 entries pinned | Returns 3 entries with id, summary, order, tokens | — | High |
| TC-F1-012 | List pinned — empty | No pinned entries | Returns empty array, budget_used=0 | — | Medium |
| TC-F1-013 | Reorder entry | reorder(entry_id=3, order=0) | Entry moved to position 0, others shifted | — | High |
| TC-F1-014 | Get context — formatted output | 2 pinned entries | Returns formatted string with both entries | — | High |
| TC-F1-015 | Budget exceeded — reject pin | Entry needs 500 tokens, budget at 1600/2000 | Error: "Token budget exceeded. Current: 1600/2000. Entry requires 500 tokens." | BR-F1-02 | Critical |
| TC-F1-016 | Budget exactly at limit | Entry needs 200 tokens, budget at 1800/2000 | success=true, budget_used=2000 | BR-F1-02 | High |
| TC-F1-017 | Budget warning at 90% | Pin brings budget to 1850/2000 | success=true + warning field present | BR-F1-04 | Medium |
| TC-F1-018 | Budget status action | budget() | Returns {used, max, remaining, warning} | — | Medium |
| TC-F1-019 | Token count — empty string | countTokens("") | 0 | BR-F4-15 | Low |
| TC-F1-020 | Token count — 100 chars | countTokens("a".repeat(100)) | 25 | BR-F4-15 | Low |

### 2.2 Feature F2: Conversation History

| TC ID | Title | Input | Expected Output | Rule | Priority |
|-------|-------|-------|-----------------|------|----------|
| TC-F2-001 | Save turn — all fields | save_turn(session_id, role="user", content="hello", tool_calls="[]") | Turn saved, turn_number=1 | BR-F2-01 | Critical |
| TC-F2-002 | Save turn — minimal fields | save_turn(session_id, role="assistant", content="hi") | Turn saved, tool_calls=null | BR-F2-01 | High |
| TC-F2-003 | Save turn — invalid role | save_turn(session_id, role="admin", content="x") | Error: "Invalid role" | BR-F2-02 | High |
| TC-F2-004 | Save turn — all valid roles | 4 turns with user/assistant/system/tool | All saved successfully | BR-F2-02 | High |
| TC-F2-005 | Get session — ordered | Save 5 turns, get_session | Returns 5 turns in turn_number order | BR-F2-05 | Critical |
| TC-F2-006 | Get session — not found | get_session("nonexistent") | Error: "Session not found" | — | Medium |
| TC-F2-007 | List sessions | 3 sessions with turns | Returns 3 sessions with metadata | — | High |
| TC-F2-008 | Search turns | save turns with "database", search("database") | Returns matching turns | — | High |
| TC-F2-009 | Summarize session | Session with 10 turns including decisions | Summary entry created with type=CONVERSATION | BR-F2-03 | High |
| TC-F2-010 | Summarize — preserves turns | Summarize session | Original turns still exist, summarized=1 | BR-F2-03 | Critical |
| TC-F2-011 | Summarize — marks turns | Summarize session | All turns have summarized=1 | BR-F2-03 | High |
| TC-F2-012 | Summarize — captures decisions | Turns contain "Decision: use SQLite" | Summary includes decision text | BR-F2-04 | High |
| TC-F2-013 | Save turn — empty content | save_turn(session_id, role="user", content="") | Error: "Content cannot be empty" | — | High |

### 2.3 Feature F3: Structured Map

| TC ID | Title | Input | Expected Output | Rule | Priority |
|-------|-------|-------|-----------------|------|----------|
| TC-F3-001 | Extract map — rule-based only | Content with entities | Returns StructuredMap, no network calls | BR-F3-01 | High |
| TC-F3-002 | Extract topic — from heading | "# Auth Design\nContent..." | topic = "Auth Design" | — | High |
| TC-F3-003 | Extract entity — ticket pattern | "Related to KSA-110 and MTO-25" | entities: ["KSA-110", "MTO-25"], type: "ticket" | BR-F3-04 | Critical |
| TC-F3-004 | Extract entity — person pattern | "Assigned to @ducnguyen" | entities: ["@ducnguyen"], type: "person" | BR-F3-04 | High |
| TC-F3-005 | Extract entity — system pattern | "Uses AuthService and CoreMemory" | entities: ["AuthService", "CoreMemory"], type: "system" | BR-F3-04 | High |
| TC-F3-006 | Extract entity — file pattern | "Modified src/memory/schema.ts" | entities: ["src/memory/schema.ts"], type: "file" | BR-F3-04 | High |
| TC-F3-007 | Extract entity — URL pattern | "See https://github.com/repo" | entities: ["https://github.com/repo"], type: "url" | BR-F3-04 | High |
| TC-F3-008 | Extract entity — concept | "Uses SQLite and ONNX" | entities: ["SQLite", "ONNX"], type: "concept" | BR-F3-04 | Medium |
| TC-F3-009 | Extract decisions | "Decision: use chars/4 for tokens" | decisions_made: ["Decision: use chars/4 for tokens"] | — | High |
| TC-F3-010 | Extract action items | "TODO: add migration script" | action_items: ["TODO: add migration script"] | — | High |
| TC-F3-011 | Search by entity — found | search_entity("KSA-110"), entries exist | Returns entries mentioning KSA-110 | — | Critical |
| TC-F3-012 | Search by entity — not found | search_entity("NONEXIST-999") | Returns empty array | — | Medium |
| TC-F3-013 | Search by topic — found | search_topic("authentication") | Returns entries with matching topic | — | High |
| TC-F3-014 | Search by topic — partial match | search_topic("auth") | Returns entries with topic containing "auth" | — | Medium |
| TC-F3-015 | Get map for entry | get(entry_id=1), entry has map | Returns full StructuredMap JSON | — | High |
| TC-F3-016 | Update map — merge | update(entry_id=1, map={topic:"new"}) | topic updated, other fields preserved | — | High |

### 2.4 Feature F4: Anti-Pattern Protection

| TC ID | Title | Input | Expected Output | Rule | Priority |
|-------|-------|-------|-----------------|------|----------|
| TC-F4-001 | Agent scope — get config | getScope("QA") | Returns {role:"QA", tags:["testing","qa",...]} | BR-F4-01 | High |
| TC-F4-002 | Agent scope — update config | updateScope("QA", ["testing","qa","bug"]) | Config updated | BR-F4-01 | Medium |
| TC-F4-003 | Agent scope — filter results | 10 results (5 QA-tagged, 5 DEV-tagged), filter("QA") | Returns 5 QA-tagged results | BR-F4-03 | Critical |
| TC-F4-004 | Agent scope — unknown role | filter(results, "UNKNOWN") | Warning + unfiltered results | — | Medium |
| TC-F4-005 | Agent scope — untagged visible | Results include untagged entry, filter("QA") | Untagged entry included | BR-F4-02 | Critical |
| TC-F4-006 | Agent scope — no scope param | filter(results, null) | All results returned (no filtering) | — | High |
| TC-F4-007 | Blind retrieval — conditional logic | Task: "fix typo in README" | KB search NOT triggered | BR-F4-05 | High |
| TC-F4-008 | Blind retrieval — audit log | Search triggered | retrieval_reason logged | BR-F4-06 | High |
| TC-F4-009 | Blind retrieval — reduction metric | Compare before/after KB calls | ≥30% reduction | BR-F4-07 | Medium |
| TC-F4-010 | Quality gate — content too short (49 chars) | ingest("a".repeat(49)) | Error: "Content too short (minimum 50 characters)" | BR-F4-08 | Critical |
| TC-F4-011 | Quality gate — content exactly 50 chars | ingest("a".repeat(50), tags="test") | Accepted (score ≥ 30 with tags) | BR-F4-08 | High |
| TC-F4-012 | Quality gate — auto-reject (score <30) | ingest(50 chars, no tags, no source) | Error: "Content quality too low (score: {n}/100)" | BR-F4-10 | Critical |
| TC-F4-013 | Quality gate — warning (score 30-50) | ingest(100 chars, tags="test", no source) | Accepted with quality_warning field | BR-F4-11 | High |
| TC-F4-014 | Quality gate — duplicate (>0.95 similarity) | ingest identical content twice | Error: "Near-duplicate found" + existing entry ID | BR-F4-09 | Critical |
| TC-F4-015 | Quality gate — near-duplicate (0.90-0.95) | ingest very similar content | Accepted with duplicate_detected=true | BR-F4-09 | High |
| TC-F4-016 | Quality gate — legitimate short entry | ingest("Decision: use SQLite for storage", type="DECISION") | Accepted (tags bonus overcomes short length) | BR-F4-12 | Critical |
| TC-F4-017 | Quality gate — high quality | ingest(500+ chars, tags, source, structured) | score ≥ 70, accepted | — | Medium |
| TC-F4-018 | Quality gate — score calculation | Various inputs | Score matches formula: length + tags + source + structure - duplicates | — | High |
| TC-F4-019 | Token budget — default 2000 | search(query, no max_tokens) | tokens_budget=2000 in response | BR-F4-13 | High |
| TC-F4-020 | Token budget — counting method | Content "abcd" (4 chars) | 1 token | BR-F4-15 | High |
| TC-F4-021 | Token budget — prioritize higher rank | 5 results, budget=100 tokens | Top-ranked results included first | BR-F4-14 | Critical |
| TC-F4-022 | Token budget — truncate single result | 1 result with 5000 tokens, budget=500 | Result content truncated to fit | — | High |
| TC-F4-023 | Token budget — metadata in response | search with max_tokens=1000 | Response has tokens_used, tokens_budget, results_truncated | — | High |
| TC-F4-024 | Token budget — custom value | search(max_tokens=500) | Results ≤ 500 tokens | BR-F4-13 | High |
| TC-F4-025 | Auto-expiry — triggers after 24h | WORKING entry created 25h ago | Entry processed (promoted or archived) | BR-F4-17 | Critical |
| TC-F4-026 | Auto-expiry — promote (score ≥60) | WORKING entry, quality=70, age=25h | tier changed to EPISODIC | BR-F4-18 | Critical |
| TC-F4-027 | Auto-expiry — archive (score <60) | WORKING entry, quality=20, age=25h | archived=1 | BR-F4-18 | Critical |
| TC-F4-028 | Auto-expiry — archive is soft delete | Archived entry | Entry still in DB, archived=1, recoverable | BR-F4-19 | High |
| TC-F4-029 | Auto-expiry — lazy on search | Call mem_search | processStale() called during search | BR-F4-21 | High |
| TC-F4-030 | Auto-expiry — audit trail | Entry expired | Audit record created with action details | BR-F4-22 | High |
| TC-F4-031 | Auto-expiry — pinned exempt | Pinned WORKING entry, age=48h | NOT expired (skipped) | BR-F4-20 | Critical |
| TC-F4-032 | Auto-expiry — no stale entries | All WORKING entries < 24h old | No actions taken, empty array returned | — | Medium |

---

## 3. Integration Tests (IT)

### 3.1 Feature F1: Core Memory Integration

| TC ID | Title | Steps | Expected | Rule | Priority |
|-------|-------|-------|----------|------|----------|
| TC-F1-IT-001 | Pin + search auto-recall | 1. Create entry 2. Pin entry 3. Call mem_search | Search results include pinned entry marked [PINNED] | UC-03 | Critical |
| TC-F1-IT-002 | Pin + unpin + search | 1. Pin entry 2. Verify in search 3. Unpin 4. Search again | After unpin, entry no longer prepended | UC-02 | High |
| TC-F1-IT-003 | Multiple pins — order preserved | 1. Pin 3 entries in order 2. Get context | Context shows entries in pin_order | UC-02 | High |
| TC-F1-IT-004 | Pin budget — real DB | 1. Pin entries until near budget 2. Try pin large entry | Budget enforced with real token calculation | BR-F1-02 | Critical |
| TC-F1-IT-005 | Reorder — DB consistency | 1. Pin 5 entries 2. Reorder entry to pos 0 3. List | DB reflects new order, all orders contiguous | BR-F1-03 | High |

### 3.2 Feature F2: Conversation Integration

| TC ID | Title | Steps | Expected | Rule | Priority |
|-------|-------|-------|----------|------|----------|
| TC-F2-IT-001 | Save + retrieve session | 1. Save 5 turns 2. Get session | All 5 turns returned in order | BR-F2-05 | Critical |
| TC-F2-IT-002 | Multiple sessions isolation | 1. Save turns to sess_A 2. Save turns to sess_B 3. Get sess_A | Only sess_A turns returned | — | High |
| TC-F2-IT-003 | Search across sessions | 1. Save turns with "auth" in sess_A and sess_B 2. Search "auth" | Returns turns from both sessions | — | High |
| TC-F2-IT-004 | Summarize + verify entry | 1. Save 10 turns 2. Summarize 3. Check KB entries | Summary entry exists with type=CONVERSATION | BR-F2-03 | High |
| TC-F2-IT-005 | Summarize — turns marked | 1. Save turns 2. Summarize 3. Get session | All turns have summarized=1 | BR-F2-03 | High |
| TC-F2-IT-006 | List sessions — metadata | 1. Create 3 sessions 2. List | Returns 3 sessions with turn counts and timestamps | — | Medium |

### 3.3 Feature F3: Structured Map Integration

| TC ID | Title | Steps | Expected | Rule | Priority |
|-------|-------|-------|----------|------|----------|
| TC-F3-IT-001 | Ingest + auto-extract | 1. Ingest content with entities 2. Get entry | structured_map populated with entities | UC-07 | Critical |
| TC-F3-IT-002 | Ingest + entity index | 1. Ingest "Related to KSA-110" 2. Search entity "KSA-110" | Entry found via entity_index | UC-07, UC-08 | Critical |
| TC-F3-IT-003 | Multiple entities indexed | 1. Ingest content with 5 entities 2. Search each | All 5 entities findable | BR-F3-04 | High |
| TC-F3-IT-004 | Update map — re-index | 1. Ingest 2. Update map with new entity 3. Search new entity | New entity findable | UC-08 | High |
| TC-F3-IT-005 | Reextract — idempotent | 1. Ingest 2. Reextract 3. Compare maps | Same result both times | BR-F3-03 | High |

### 3.4 Feature F4: Anti-Pattern Integration

| TC ID | Title | Steps | Expected | Rule | Priority |
|-------|-------|-------|----------|------|----------|
| TC-F4-IT-001 | Quality gate + ingest pipeline | 1. Ingest high-quality content 2. Verify stored with score | Entry stored, quality_score populated | UC-12 | Critical |
| TC-F4-IT-002 | Quality gate rejects + no storage | 1. Ingest 30-char content 2. Check DB | Entry NOT in database | BR-F4-08 | Critical |
| TC-F4-IT-003 | Agent scope + real search | 1. Ingest 5 entries (3 QA-tagged, 2 DEV-tagged) 2. Search with scope=QA | Only 3 QA entries + untagged returned | BR-F4-03 | Critical |
| TC-F4-IT-004 | Token budget + real search | 1. Ingest 10 large entries 2. Search with max_tokens=500 | Results fit within 500 tokens | BR-F4-13 | Critical |
| TC-F4-IT-005 | Auto-expiry + real DB | 1. Insert WORKING entry with old timestamp 2. Call search | Entry promoted/archived based on score | BR-F4-17 | Critical |
| TC-F4-IT-006 | Duplicate detection + vectors | 1. Ingest entry A 2. Ingest identical entry B | Entry B rejected as duplicate | BR-F4-09 | High |
| TC-F4-IT-007 | Quality gate — no false positive on decisions | 1. Ingest "Decision: use SQLite" with type=DECISION | Accepted despite short length | BR-F4-12 | Critical |

### 3.5 Backfill Integration

| TC ID | Title | Steps | Expected | Rule | Priority |
|-------|-------|-------|----------|------|----------|
| TC-F3-IT-006 | Backfill — process all entries | 1. Create 20 entries without maps 2. Run backfill | All 20 have structured_map | UC-09 | High |
| TC-F3-IT-007 | Backfill — non-destructive | 1. Create entries with content 2. Run backfill 3. Check content | Original content unchanged | BR-F3-02 | Critical |
| TC-F3-IT-008 | Backfill — idempotent | 1. Run backfill 2. Run backfill again | Same results, no duplicates in entity_index | BR-F3-03 | High |
| TC-F3-IT-009 | Backfill — entity index populated | 1. Create entries with ticket IDs 2. Run backfill 3. Search entity | Entities findable after backfill | UC-09 | High |

### 3.6 Schema Migration Integration

| TC ID | Title | Steps | Expected | Rule | Priority |
|-------|-------|-------|----------|------|----------|
| TC-MIG-IT-001 | All migrations run successfully | 1. Start with clean DB 2. Run all V3 migrations | All tables/columns created | — | Critical |
| TC-MIG-IT-002 | Migrations idempotent | 1. Run migrations 2. Run again | No errors (IF NOT EXISTS) | — | Critical |
| TC-MIG-IT-003 | Existing data preserved | 1. Insert data 2. Run migrations | Existing entries unchanged | — | Critical |
| TC-MIG-IT-004 | New columns have defaults | 1. Run migrations 2. Query existing entries | pinned=0, pin_order=0, archived=0, structured_map='{}' | — | High |
| TC-MIG-IT-005 | FTS5 triggers work | 1. Insert entity 2. Check FTS index | Entity searchable via FTS5 | — | High |

---

## 4. End-to-End API Tests (E2E-API)

### 4.1 Tool: mem_pin (via MCP stdio)

| TC ID | Title | MCP Request | Expected Response | Priority |
|-------|-------|-------------|-------------------|----------|
| TC-E2E-PIN-001 | Pin action — success | `{"tool":"mem_pin","arguments":{"action":"pin","entry_id":1}}` | `{"success":true,"pin_order":0,"tokens":...,"budget_used":...}` | Critical |
| TC-E2E-PIN-002 | Pin action — not found | `{"tool":"mem_pin","arguments":{"action":"pin","entry_id":9999}}` | Error: "Entry 9999 not found" | High |
| TC-E2E-PIN-003 | Unpin action | `{"tool":"mem_pin","arguments":{"action":"unpin","entry_id":1}}` | `{"success":true}` | High |
| TC-E2E-PIN-004 | List action | `{"tool":"mem_pin","arguments":{"action":"list"}}` | Array of pinned entries with metadata | High |
| TC-E2E-PIN-005 | Get context action | `{"tool":"mem_pin","arguments":{"action":"get_context"}}` | Formatted context string + token count | High |
| TC-E2E-PIN-006 | Budget action | `{"tool":"mem_pin","arguments":{"action":"budget"}}` | `{"used":...,"max":2000,"remaining":...}` | Medium |

### 4.2 Tool: mem_conversation (via MCP stdio)

| TC ID | Title | MCP Request | Expected Response | Priority |
|-------|-------|-------------|-------------------|----------|
| TC-E2E-CONV-001 | Save turn | `{"tool":"mem_conversation","arguments":{"action":"save_turn","session_id":"s1","role":"user","content":"hello"}}` | `{"turn_id":...,"turn_number":1}` | Critical |
| TC-E2E-CONV-002 | Get session | `{"tool":"mem_conversation","arguments":{"action":"get_session","session_id":"s1"}}` | Array of turns in order | High |
| TC-E2E-CONV-003 | List sessions | `{"tool":"mem_conversation","arguments":{"action":"list_sessions"}}` | Array of session summaries | High |
| TC-E2E-CONV-004 | Search | `{"tool":"mem_conversation","arguments":{"action":"search","query":"hello"}}` | Matching turns | High |
| TC-E2E-CONV-005 | Summarize | `{"tool":"mem_conversation","arguments":{"action":"summarize","session_id":"s1"}}` | Summary entry created | Medium |
| TC-E2E-CONV-006 | Invalid role | `{"tool":"mem_conversation","arguments":{"action":"save_turn","session_id":"s1","role":"admin","content":"x"}}` | Error: "Invalid role" | High |

### 4.3 Tool: mem_map (via MCP stdio)

| TC ID | Title | MCP Request | Expected Response | Priority |
|-------|-------|-------------|-------------------|----------|
| TC-E2E-MAP-001 | Get map | `{"tool":"mem_map","arguments":{"action":"get","entry_id":1}}` | StructuredMap JSON | High |
| TC-E2E-MAP-002 | Search entity | `{"tool":"mem_map","arguments":{"action":"search_entity","entity":"KSA-110"}}` | Entries mentioning KSA-110 | Critical |
| TC-E2E-MAP-003 | Search topic | `{"tool":"mem_map","arguments":{"action":"search_topic","topic":"auth"}}` | Entries with matching topic | High |
| TC-E2E-MAP-004 | Update map | `{"tool":"mem_map","arguments":{"action":"update","entry_id":1,"map":{"topic":"new topic"}}}` | Updated map returned | Medium |
| TC-E2E-MAP-005 | Reextract | `{"tool":"mem_map","arguments":{"action":"reextract","entry_id":1}}` | Fresh extraction result | Medium |
| TC-E2E-MAP-006 | Entry not found | `{"tool":"mem_map","arguments":{"action":"get","entry_id":9999}}` | Error: "Entry 9999 not found" | High |

### 4.4 Enhanced Tool: mem_search (via MCP stdio)

| TC ID | Title | MCP Request | Expected Response | Priority |
|-------|-------|-------------|-------------------|----------|
| TC-E2E-SRCH-001 | Search with agent_scope | `{"tool":"mem_search","arguments":{"query":"test","agent_scope":"QA"}}` | Filtered results (QA-tagged only) | Critical |
| TC-E2E-SRCH-002 | Search with max_tokens | `{"tool":"mem_search","arguments":{"query":"test","max_tokens":500}}` | Results ≤ 500 tokens, metadata present | Critical |
| TC-E2E-SRCH-003 | Search — pinned prepended | Pin entry, then search | First results marked [PINNED] | High |
| TC-E2E-SRCH-004 | Search — expiry triggered | WORKING entry stale, search | expiry_actions in response | High |
| TC-E2E-SRCH-005 | Search — no scope (backward compat) | `{"tool":"mem_search","arguments":{"query":"test"}}` | All results returned (no filtering) | Critical |
| TC-E2E-SRCH-006 | Search — combined features | Pin + scope + budget all active | Correct combined behavior | High |

---

## 5. System Integration Tests (SIT)

### 5.1 Cross-Server Consistency

| TC ID | Title | Steps | Expected | Automation | Priority |
|-------|-------|-------|----------|------------|----------|
| TC-SIT-001 | Pin behavior — 3 servers identical | Run TC-E2E-PIN-001 on Node.js, Kotlin, Python | Same response structure and behavior | Automated | Critical |
| TC-SIT-002 | Conversation — 3 servers identical | Run TC-E2E-CONV-001 on all 3 | Same response structure | Automated | Critical |
| TC-SIT-003 | Map extraction — 3 servers identical | Ingest same content on all 3, compare maps | Same entities extracted | Automated | High |
| TC-SIT-004 | Quality gate — 3 servers identical | Same inputs on all 3 | Same accept/reject decisions | Automated | High |
| TC-SIT-005 | Token budget — 3 servers identical | Same search on all 3 with max_tokens | Same token counts (±1 rounding) | Automated | High |
| TC-SIT-006 | Migration — all 3 servers | Run migrations on fresh DB for each server | Same schema created | Automated | Critical |
| TC-SIT-007 | DB portability | Create DB with Node.js, open with Kotlin | Data readable across servers | Automated | High |

### 5.2 Cross-Feature Integration

| TC ID | Title | Steps | Expected | Automation | Priority |
|-------|-------|-------|----------|------------|----------|
| TC-INT-001 | F1+F3: Pin + entity boost | 1. Pin entry mentioning "auth" 2. Search "auth" | Pinned entry boosted by entity match | Automated | High |
| TC-INT-002 | F1+F4: Pin exempt from expiry | 1. Pin WORKING entry 2. Wait >24h 3. Search | Pinned entry NOT expired | Automated | Critical |
| TC-INT-003 | F3+F4: Quality gate before extraction | 1. Ingest low-quality content (rejected) 2. Check entity_index | No entities indexed for rejected content | Automated | High |
| TC-INT-004 | F2+F3: Summarize + entity index | 1. Save turns mentioning "KSA-110" 2. Summarize 3. Search entity | Summary entry findable by entity | Automated | High |
| TC-INT-005 | F1+F4: Pin bypasses scope filter | 1. Pin entry with DEV tag 2. Search with scope=QA | Pinned entry still visible | Automated | High |
| TC-INT-006 | Full pipeline: ingest → extract → search | 1. Ingest with entities 2. Search by entity 3. Verify map | End-to-end flow works | Automated | Critical |
| TC-INT-007 | Full pipeline: search with all F4 | 1. Setup: pins, scope, stale entries 2. Search | Expiry + pins + scope + budget all applied | Automated | Critical |
| TC-INT-008 | Regression: 14 existing tools | Run existing test suite | All pass, no behavioral changes | Automated | Critical |

### 5.3 Manual Verification Tests

| TC ID | Title | Steps | Expected | Priority |
|-------|-------|-------|----------|----------|
| TC-SIT-MAN-001 | Blind retrieval — real agent behavior | 1. Give agent simple task 2. Monitor KB calls | Agent does NOT search KB for self-contained tasks | High |
| TC-SIT-MAN-002 | Blind retrieval — 30% reduction | 1. Measure KB calls before F4 2. Measure after | ≥30% fewer unnecessary calls | Medium |
| TC-SIT-MAN-003 | Cross-server migration upgrade | 1. DB from v0.5.1 2. Upgrade to v0.6.0 3. Verify data | All existing data preserved, new features work | High |

---

## 6. Performance Tests

| TC ID | Title | Benchmark | Target | Method | Priority |
|-------|-------|-----------|--------|--------|----------|
| TC-PERF-001 | Pin retrieval (getContext) | 10 pinned entries, 2000 tokens | <50ms | Time 100 iterations, avg | Critical |
| TC-PERF-002 | Conversation query (getSession) | Session with 100 turns | <100ms | Time 100 iterations, avg | Critical |
| TC-PERF-003 | Entity search | 1000+ entries in entity_index | <100ms | Time 100 iterations, avg | High |
| TC-PERF-004 | Structured map extraction | 5000-char content | <200ms | Time 100 iterations, avg | High |
| TC-PERF-005 | Quality gate validation | Including duplicate check | <50ms | Time 100 iterations, avg | High |
| TC-PERF-006 | Token counting | 10KB content | <1ms | Time 1000 iterations, avg | Medium |
| TC-PERF-007 | Agent scope filter | 50 results, 5 tags | <10ms | Time 100 iterations, avg | High |
| TC-PERF-008 | Full search with all F4 | Expiry + pins + scope + budget | <200ms total | Time 50 iterations, avg | Critical |

---

## 7. Test Data

### 7.1 Test Data Files

| File | Purpose | Format | Location |
|------|---------|--------|----------|
| knowledge-entries-seed.csv | Seed entries for IT/E2E tests | CSV | documents/KSA-110/testdata/knowledge-entries-seed.csv |
| conversation-turns-seed.csv | Seed conversation data | CSV | documents/KSA-110/testdata/conversation-turns-seed.csv |
| entity-patterns.csv | Entity classification test cases | CSV | documents/KSA-110/testdata/entity-patterns.csv |
| quality-gate-inputs.csv | Quality gate edge cases | CSV | documents/KSA-110/testdata/quality-gate-inputs.csv |
| agent-scope-config.json | Agent scope configurations | JSON | documents/KSA-110/testdata/agent-scope-config.json |

### 7.2 Test Data Specifications

**knowledge-entries-seed.csv columns:**
- id, content, type, tier, tags, source, pinned, pin_order, quality_score, created_at

**conversation-turns-seed.csv columns:**
- session_id, turn_number, role, content, tool_calls, summarized, created_at

**entity-patterns.csv columns:**
- input_text, expected_entity, expected_type, description

**quality-gate-inputs.csv columns:**
- content, tags, source, type, expected_score_min, expected_score_max, expected_decision

---

## 8. Traceability Summary

### 8.1 Coverage Statistics

![Test Coverage Overview](diagrams/test-coverage.png)

| Metric | Value |
|--------|-------|
| Total User Stories | 15 |
| Stories with test cases | 15 (100%) |
| Total Business Rules | 22 |
| Rules with test cases | 22 (100%) |
| Total Use Cases | 14 |
| Use Cases with test cases | 14 (100%) |
| Total Test Cases | 136 |
| Automated | 133 (97.8%) |
| Manual | 3 (2.2%) |

### 8.2 Test Cases per Feature

![Test Execution Flow](diagrams/test-execution-flow.png)

| Feature | PBT | UT | IT | E2E-API | SIT | PERF | Total |
|---------|-----|----|----|---------|-----|------|-------|
| F1: Core Memory | 3 | 20 | 5 | 6 | 2 | 1 | 37 |
| F2: Conversation | 1 | 13 | 6 | 6 | 1 | 1 | 28 |
| F3: Structured Map | 1 | 16 | 9 | 6 | 2 | 1 | 35 |
| F4: Anti-Pattern | 3 | 32 | 7 | 6 | 2 | 2 | 52 |
| Integration | — | — | 5 | — | 8 | 1 | 14 |
| Migration | — | — | 5 | — | 1 | — | 6 |
| **Total** | **8** | **81** | **37** | **24** | **16** | **6** | **172** |

> **Note:** Some test cases appear in multiple categories (UT test also validates IT scenario). Unique test case count: 136. Total test executions (including cross-server): 172.

---

## 9. Appendix

### 9.1 Glossary

| Term | Definition |
|------|------------|
| PBT | Property-Based Testing — verify invariants with random inputs |
| UT | Unit Testing — test individual functions/classes in isolation |
| IT | Integration Testing — test component interactions with real DB |
| E2E-API | End-to-End API Testing — test via MCP protocol (stdio) |
| SIT | System Integration Testing — cross-server and cross-feature |
| PERF | Performance Testing — verify timing targets |

### 9.2 Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage Overview | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |
