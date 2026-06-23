# Business Requirements Document (BRD)

## mcp-code-intelligence-nodejs — KSA-110: KB System Upgrade v0.6.0

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-110 |
| Title | KB System Upgrade v0.6.0 |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-01-27 |
| Status | Draft |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | Duc Nguyen Minh – Product Owner | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-27 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-110 and linked tasks KSA-111, KSA-112, KSA-113, KSA-114 |
| 1.1 | 2025-05-22 | BA Agent | Add F4: KB Anti-Pattern Protection — agent isolation, blind retrieval prevention, ingest quality gate, search token budget (from KB-discussion analysis) |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| Duc Nguyen Minh | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

Nâng cấp hệ thống Knowledge Base (KB) của mcp-code-intelligence-nodejs từ v0.5.1 lên v0.6.0 với 3 features chính:

1. **Core/Archival Memory (F1)** — Pinned entries tự động inject vào agent context mỗi turn, giới hạn ~2000 tokens
2. **Structured Conversation History (F2)** — Lưu trữ conversations dạng structured JSON (role, content, turn, session) thay vì flat text
3. **Structured Map (F3)** — Mỗi entry được enrich với metadata: topic, entities_mentioned, decisions_made, action_items, context_refs, sentiment

4. **KB Anti-Pattern Protection (F4)** — Ngăn chặn các anti-patterns đốt token: agent-level KB isolation (tag-based filtering), blind retrieval prevention (conditional search), ingest quality gate (auto-validate trước khi lưu), search token budget (cap output tokens)

Scope bao gồm schema migrations (SQLite + FTS5), 3 MCP tools mới (`mem_pin`, `mem_conversation`, `mem_map`), token counting utility, conversation summarizer, structured map extractor (rule-based NLP), backfill script, cross-feature integration, và F4 anti-pattern protection mechanisms.

### 1.2 Out of Scope

- LLM-assisted extraction (chỉ dùng rule-based NLP cho v0.6.0)
- UI/Frontend changes (hệ thống là MCP server, không có UI)
- Breaking changes đến 14 existing MCP tools
- Multi-tenant support
- Cloud deployment (chỉ local SQLite)

### 1.3 Preliminary Requirement

- mcp-code-intelligence-nodejs v0.5.1 đã hoạt động ổn định
- SQLite database với schema hiện tại (`knowledge_entries`, `knowledge_vectors`, `knowledge_graph_edges`, sessions/audit)
- better-sqlite3 package đã cài đặt
- ONNX embedding model (all-MiniLM-L6-v2, 384d) hoạt động
- Node.js runtime environment

---

## 2. Business Requirements

### 2.1 High Level Process Map

Hệ thống KB hiện tại cung cấp 14 MCP tools cho AI agents để lưu trữ và truy xuất knowledge. Upgrade v0.6.0 bổ sung 3 capabilities mới:

1. **Persistent Context** — Agents có thể pin critical entries để tự động nhận context mỗi lần tương tác (không cần search lại)
2. **Conversation Memory** — Conversations được lưu structured, cho phép query theo session/time range và auto-summarize
3. **Smart Metadata** — Entries tự động được extract entities, decisions, action items → search chính xác hơn

![Business Flow](diagrams/business-flow.png)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As an AI agent, I want to pin critical knowledge entries so that they are automatically available in my context every turn without searching | MUST HAVE | KSA-111 |
| 2 | As an AI agent, I want to manage pinned entries (pin/unpin/reorder) so that I can control what persistent context I receive | MUST HAVE | KSA-111 |
| 3 | As an AI agent, I want a token budget enforced on pinned entries so that my context window is not overwhelmed | MUST HAVE | KSA-111 |
| 4 | As an AI agent, I want to store conversation turns as structured data so that I can query past conversations by session or time range | SHOULD HAVE | KSA-113 |
| 5 | As an AI agent, I want conversations auto-summarized on session end so that old turns are compressed without losing key information | SHOULD HAVE | KSA-113 |
| 6 | As an AI agent, I want each knowledge entry to have extracted metadata (entities, decisions, action items) so that search results are more relevant | MUST HAVE | KSA-112 |
| 7 | As an AI agent, I want to search entries by entity name or topic so that I can find related knowledge quickly | MUST HAVE | KSA-112 |
| 8 | As an AI agent, I want existing entries backfilled with structured maps so that the enhanced search works on historical data | SHOULD HAVE | KSA-112 |
| 9 | As a system, I want all 3 features integrated without conflicts so that the KB operates as a cohesive system | MUST HAVE | KSA-114 |
| 10 | As a system, I want performance targets met (<50ms pin retrieval, <100ms conversation query) so that agent responsiveness is maintained | MUST HAVE | KSA-114 |
| 11 | As an AI agent, I want tag-based KB isolation so that each agent role only retrieves knowledge relevant to its domain | MUST HAVE | KSA-110 (F4) |
| 12 | As a system, I want blind retrieval prevention so that KB search is only triggered when the task genuinely requires historical context | MUST HAVE | KSA-110 (F4) |
| 13 | As a system, I want an ingest quality gate that validates content before storing to prevent KB pollution with incorrect or low-quality data | SHOULD HAVE | KSA-110 (F4) |
| 14 | As an AI agent, I want a max_tokens parameter on mem_search so that search results never exceed a configurable token budget | MUST HAVE | KSA-110 (F4) |
| 15 | As a system, I want WORKING tier auto-expiry so that stale short-term entries are promoted or archived after 24h, preventing noise accumulation | SHOULD HAVE | KSA-110 (F4) |

![Use Case Diagram](diagrams/use-case.png)

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Agent starts a session → system loads pinned entries (F1) into context automatically

**Step 2:** Agent performs `mem_search` → system prepends pinned entries to results + boosts results matching entities/topics from query (F3)

**Step 3:** Agent ingests new knowledge → system auto-extracts structured_map (topic, entities, decisions, action_items) (F3)

**Step 4:** Agent saves conversation turn → system stores structured JSON with role/content/tool_calls (F2)

**Step 5:** Session ends → system auto-summarizes old conversation turns into a summary entry (F2)

**Step 6:** Agent queries past conversations → system returns structured turns filtered by session/time range (F2)

> **Note:** All 3 features operate independently at schema level but share common infrastructure (schema-v2.ts, models.ts, tool-definitions). F1 auto-recall can leverage F3 entity matching for smarter context injection.

---

#### STORY 1: Pin Critical Knowledge Entries

> As an AI agent, I want to pin critical knowledge entries so that they are automatically available in my context every turn without searching

**Requirement Details:**

1. Agent can mark any existing knowledge entry as "pinned" via `mem_pin` tool
2. Pinned entries are automatically prepended to every `mem_search` result
3. Maximum 10 pinned entries allowed (safety cap)
4. Total pinned content must not exceed 2000 tokens (budget enforcement)
5. Pin order is configurable (reorder operation)

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| pinned | BOOLEAN | Yes | Whether entry is pinned | 1 |
| pin_order | INTEGER | Yes | Display/injection order | 0, 1, 2... |

**Acceptance Criteria:**

1. `pinned` column added to `knowledge_entries` table via migration
2. Pin/unpin/list/reorder operations work via `mem_pin` tool
3. Pinned entries auto-prepend to `mem_search` results
4. Token budget enforced — attempting to pin entry that exceeds budget returns error with current usage
5. Max 10 pinned entries safety cap enforced
6. Unit tests pass (≥80% coverage on new code)
7. Performance: <50ms for pin retrieval

**Validation Rules:**

- Cannot pin more than 10 entries
- Cannot exceed 2000 token budget
- Cannot pin non-existent entry
- Pin order must be non-negative integer

**Error Handling:**

- Pin entry exceeds budget: Return error "Token budget exceeded. Current: {current}/{max}. Entry requires {needed} tokens."
- Pin non-existent entry: Return error "Entry {id} not found"
- Exceed max pinned: Return error "Maximum pinned entries (10) reached. Unpin an entry first."

---

#### STORY 2: Manage Pinned Entries

> As an AI agent, I want to manage pinned entries (pin/unpin/reorder) so that I can control what persistent context I receive

**Requirement Details:**

1. `mem_pin` tool supports actions: `pin`, `unpin`, `list`, `reorder`, `get_context`
2. `pin` action: marks entry as pinned, assigns next available order
3. `unpin` action: removes pin, reorders remaining entries
4. `list` action: returns all pinned entries with order and token count
5. `reorder` action: changes pin_order of specified entry
6. `get_context` action: returns formatted pinned content ready for injection

**Acceptance Criteria:**

1. All 5 actions callable via MCP protocol
2. Unpin automatically reorders remaining entries (no gaps)
3. List shows token count per entry and total budget usage
4. Get_context returns entries in pin_order, formatted for agent consumption

---

#### STORY 3: Token Budget Enforcement

> As an AI agent, I want a token budget enforced on pinned entries so that my context window is not overwhelmed

**Requirement Details:**

1. Token counting uses chars/4 approximation (simple, no external dependency)
2. Budget check on every pin operation
3. Budget configurable via `CoreMemoryConfig` (default: 2000 tokens)
4. Warning threshold at 90% (1800 tokens default)

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| maxTokens | INTEGER | Yes | Hard token limit | 2000 |
| warningThreshold | INTEGER | Yes | Warning level | 1800 |
| countMethod | STRING | Yes | Token counting method | 'chars_div_4' |
| maxPinnedEntries | INTEGER | Yes | Safety cap | 10 |

**Acceptance Criteria:**

1. Token count calculated correctly (content.length / 4)
2. Pin rejected when budget would be exceeded
3. Warning returned when threshold crossed
4. Config values respected

---

#### STORY 4: Structured Conversation Storage

> As an AI agent, I want to store conversation turns as structured data so that I can query past conversations by session or time range

**Requirement Details:**

1. New `conversation_turns` table stores each turn with: session_id, turn_number, role, content, tool_calls (JSON), metadata (JSON), timestamp
2. Roles: 'user', 'assistant', 'system', 'tool'
3. `mem_conversation` tool supports: `save_turn`, `list_sessions`, `get_session`, `search_turns`
4. Query by session_id returns all turns in order
5. Query by time range returns turns across sessions

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| session_id | TEXT | Yes | Session identifier | "sess_abc123" |
| turn_number | INTEGER | Yes | Sequential turn number | 1, 2, 3... |
| role | TEXT | Yes | Speaker role | "user", "assistant" |
| content | TEXT | Yes | Turn content | "Search for auth patterns" |
| tool_calls | TEXT (JSON) | No | Tool calls made | [{"name": "mem_search", ...}] |
| metadata | TEXT (JSON) | No | Extra metadata | {"tokens": 150, "model": "claude"} |

**Acceptance Criteria:**

1. `conversation_turns` table created via migration
2. Turns persist with all fields correctly
3. Query by session returns turns in turn_number order
4. Query by time range works across sessions
5. `mem_conversation` tool callable with all 4 actions
6. Performance: <100ms for conversation query

---

#### STORY 5: Conversation Auto-Summarization

> As an AI agent, I want conversations auto-summarized on session end so that old turns are compressed without losing key information

**Requirement Details:**

1. When session ends, turns older than configurable threshold are summarized
2. Summary stored as a new knowledge entry (type: CONVERSATION)
3. Original turns retained but marked as summarized
4. Summary includes: key decisions, action items, topics discussed

**Acceptance Criteria:**

1. Summarization triggers on session end
2. Summary entry created with correct type and tags
3. Original turns not deleted (data preservation)
4. Summary captures key information from conversation

---

#### STORY 6: Auto-Extract Structured Map on Ingest

> As an AI agent, I want each knowledge entry to have extracted metadata (entities, decisions, action items) so that search results are more relevant

**Requirement Details:**

1. On every `mem_ingest`, system auto-extracts `structured_map` from content
2. Extraction is rule-based (no LLM dependency):
   - **topic**: First heading or first sentence
   - **entities_mentioned**: Regex for ticket IDs (`[A-Z]+-\d+`), file paths, @mentions, PascalCase class names
   - **decisions_made**: Lines starting with "Decision:", "Decided:", "We will", "Chosen approach"
   - **action_items**: Lines with "TODO", "Action:", "Next step:", checkbox patterns
   - **context_refs**: URLs, file paths, ticket IDs
   - **sentiment**: Keyword scoring (positive/negative word lists)
3. Extracted entities stored in separate `entity_index` table for fast lookup

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| structured_map | TEXT (JSON) | Yes | Extracted metadata | {"topic": "Auth design", ...} |
| entity_name | TEXT | Yes | Entity in entity_index | "KSA-110", "AuthService" |
| entity_type | TEXT | Yes | Entity classification | "ticket", "system", "file" |

**Acceptance Criteria:**

1. `structured_map` column added to `knowledge_entries`
2. `entity_index` table created with proper indexes
3. Auto-extraction runs on every ingest without errors
4. Extraction correctly identifies entities, decisions, action items
5. Entity types correctly classified (person/system/concept/file/ticket)

---

#### STORY 7: Search by Entity/Topic

> As an AI agent, I want to search entries by entity name or topic so that I can find related knowledge quickly

**Requirement Details:**

1. `mem_map` tool supports: `get_map`, `update_map`, `search_entity`, `search_topic`
2. `search_entity`: find all entries mentioning a specific entity
3. `search_topic`: find entries with matching topic
4. HybridSearch enhanced to boost results matching entities/topics from query

**Acceptance Criteria:**

1. `mem_map` tool callable with all 4 actions
2. Entity search returns relevant entries
3. Topic search returns relevant entries
4. HybridSearch boost improves result relevance

---

#### STORY 8: Backfill Existing Entries

> As an AI agent, I want existing entries backfilled with structured maps so that the enhanced search works on historical data

**Requirement Details:**

1. Backfill script processes all existing entries
2. Extracts structured_map for each entry
3. Populates entity_index table
4. Non-destructive (never modifies original content)
5. Idempotent (safe to run multiple times)

**Acceptance Criteria:**

1. Script processes all existing entries without data loss
2. structured_map populated for all entries
3. entity_index populated correctly
4. Script is idempotent
5. Performance acceptable for large KBs (1000+ entries)

---

---

#### STORY 11: Agent-Level KB Isolation (Tag-Based Filtering)

> As an AI agent, I want tag-based KB isolation so that each agent role only retrieves knowledge relevant to its domain

**Requirement Details:**

1. Mỗi agent role (BA, SA, DEV, QA, DevOps) có một predefined tag set
2. `mem_search` hỗ trợ `agent_scope` parameter — tự động filter results theo tags của agent role
3. Agent scope mapping configurable (không hardcode):
   - QA agent → tags: `testing, qa, test-plan, test-case`
   - DEV agent → tags: `code, api, architecture, implementation`
   - BA agent → tags: `requirement, business, stakeholder`
4. Khi `agent_scope` được set, results chỉ trả về entries có ít nhất 1 matching tag
5. Entries không có tags vẫn visible cho tất cả agents (backward compatible)

**Acceptance Criteria:**

1. `mem_search` accepts optional `agent_scope` parameter
2. Results correctly filtered by agent's tag set
3. Untagged entries remain accessible to all agents
4. Agent scope mapping configurable via settings
5. No performance degradation (filter applied at query level, not post-filter)

---

#### STORY 12: Blind Retrieval Prevention

> As a system, I want blind retrieval prevention so that KB search is only triggered when the task genuinely requires historical context

**Requirement Details:**

1. Steering rule `agent-self-learning` updated: thay "luôn search KB trước mọi task" bằng conditional logic
2. Conditions khi PHẢI search KB:
   - Task liên quan đến architecture decisions đã có
   - Task cần reference đến previous implementations
   - Task involves entities/tickets đã được discuss trước đó
3. Conditions khi KHÔNG cần search KB:
   - Task đơn giản, self-contained (sửa typo, format code)
   - Task có đầy đủ context trong prompt hiện tại
   - Task là greenfield (chưa có history)
4. `mem_search` trả về metadata `retrieval_reason` để audit tại sao search được trigger

**Acceptance Criteria:**

1. Steering rule updated với conditional search logic
2. Agents không search KB cho simple/self-contained tasks
3. Token savings measurable (giảm ≥30% unnecessary KB calls)
4. Audit trail: mỗi search ghi lại reason

---

#### STORY 13: Ingest Quality Gate

> As a system, I want an ingest quality gate that validates content before storing to prevent KB pollution

**Requirement Details:**

1. Trước khi `mem_ingest` lưu entry, chạy quality validation:
   - **Minimum content length**: ≥50 characters (reject noise)
   - **Duplicate detection**: cosine similarity >0.95 với existing entry → reject hoặc merge
   - **Contradiction detection**: nếu entry contradicts existing entry cùng topic → flag for review
   - **Staleness check**: nếu entry references outdated info (old ticket status) → warning
2. Quality score tự động assigned (0-100) dựa trên:
   - Content length (longer = higher, cap at 500 chars)
   - Has structured data (tags, type specified) = +20
   - Has source reference = +10
   - Duplicate penalty = -50
3. Entries với quality score <30 bị reject tự động
4. Entries score 30-50 được lưu với warning flag

**Acceptance Criteria:**

1. Quality validation runs on every `mem_ingest` call
2. Low-quality entries rejected with clear error message
3. Duplicate entries detected and handled (reject or merge suggestion)
4. Quality score visible via `mem_scoring` tool
5. No false positives on legitimate short entries (e.g., decisions)

---

#### STORY 14: Search Token Budget (max_tokens)

> As an AI agent, I want a max_tokens parameter on mem_search so that search results never exceed a configurable token budget

**Requirement Details:**

1. `mem_search` accepts optional `max_tokens` parameter (default: 2000)
2. Results are truncated/limited to fit within token budget:
   - First: limit number of results
   - Then: truncate individual result content if still over budget
3. Token counting uses same chars/4 method as F1
4. Response includes `tokens_used` and `tokens_budget` metadata
5. If single result exceeds budget, return summary instead of full content

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| max_tokens | INTEGER | No | Token budget for search results | 2000 |
| tokens_used | INTEGER | Yes (response) | Actual tokens in response | 1850 |
| tokens_budget | INTEGER | Yes (response) | Budget that was applied | 2000 |

**Acceptance Criteria:**

1. `mem_search` respects `max_tokens` parameter
2. Results never exceed specified token budget
3. Truncation is intelligent (prioritize higher-ranked results)
4. Response metadata includes token usage info
5. Default 2000 tokens when parameter not specified
6. Performance: no significant overhead from token counting

---

#### STORY 15: WORKING Tier Auto-Expiry

> As a system, I want WORKING tier auto-expiry so that stale short-term entries are promoted or archived after 24h

**Requirement Details:**

1. WORKING tier entries older than 24h are auto-processed:
   - If quality score ≥60 → promote to EPISODIC tier
   - If quality score <60 → archive (soft delete, recoverable)
2. Auto-expiry runs as background check on every `mem_search` call (lazy evaluation)
3. Configurable expiry duration (default: 24h)
4. Entries with `pinned=true` exempt from auto-expiry
5. Audit log records all auto-expiry actions

**Acceptance Criteria:**

1. WORKING entries auto-expire after configured duration
2. High-quality entries promoted (not lost)
3. Low-quality entries archived (not permanently deleted)
4. Pinned entries exempt
5. Audit trail for all auto-expiry actions
6. No performance impact on normal operations

---

#### STORY 9: Cross-Feature Integration

> As a system, I want all 3 features integrated without conflicts so that the KB operates as a cohesive system

**Requirement Details:**

1. F1 auto-recall enhanced with F3 entity matching (smarter context injection)
2. All 3 features share schema-v2.ts migrations without conflicts
3. No regressions in existing 14 MCP tools
4. Version bumped to 0.6.0
5. README updated with new tool documentation

**Acceptance Criteria:**

1. All 3 features work together without conflicts
2. F1 + F3 integration: pinned entries can be filtered by entity relevance
3. No regressions in existing tools (full regression test)
4. Version 0.6.0 in package.json
5. README documents `mem_pin`, `mem_conversation`, `mem_map`

---

#### STORY 10: Performance Targets

> As a system, I want performance targets met so that agent responsiveness is maintained

**Requirement Details:**

1. Pin retrieval: <50ms (CoreMemoryManager.getContext())
2. Conversation query: <100ms (ConversationRepository.getSession())
3. Entity search: <100ms (entity_index lookup)
4. Structured map extraction: <200ms per entry (rule-based, no network calls)

**Acceptance Criteria:**

1. Pin retrieval consistently <50ms under normal load
2. Conversation query <100ms for sessions with up to 100 turns
3. Performance benchmarks documented
4. No degradation of existing search performance

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| SQLite + better-sqlite3 | System | N/A | Database engine for all storage |
| ONNX Runtime | System | N/A | Embedding model for vector search |
| Existing schema (knowledge_entries, knowledge_vectors) | System | N/A | Base tables that migrations extend |
| FTS5 extension | System | N/A | Full-text search for entity_index |
| Node.js ≥18 | Infrastructure | N/A | Runtime environment |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Product Owner | Duc Nguyen Minh | Approve requirements, accept delivery | Jira reporter |
| Developer | Development Team | Implement features | Jira assignee |
| QA | QA Team | Test all features | Jira workflow |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Schema migration breaks existing DB | High | Low | Additive-only migrations (ALTER ADD, CREATE TABLE). Never DROP. |
| Token counting inaccuracy | Low | Medium | Use chars/4 approximation. Good enough for 2000 token budget. |
| Structured map extraction quality | Medium | Medium | Start rule-based. Add LLM-assisted extraction as optional enhancement later. |
| Conversation table grows large | Medium | High | Auto-summarize sessions older than 7 days. Configurable retention. |
| Tool count explosion (14 → 17) | Low | Low | Keep consolidated pattern. Each new tool is multi-action. |
| Merge conflicts on shared files | Medium | Medium | Do schema-v2.ts first (all features), then implement sequentially. |

### 5.2 Assumptions

- Existing database schema is stable and won't change during development
- chars/4 token approximation is acceptable accuracy for budget enforcement
- Rule-based extraction provides sufficient quality for v0.6.0 (LLM enhancement deferred)
- Sessions older than 7 days can be safely summarized
- Maximum 10 pinned entries is sufficient for all use cases
- Performance targets achievable with SQLite (no need for external DB)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Pin retrieval <50ms | CoreMemoryManager.getContext() must return within 50ms |
| Performance | Conversation query <100ms | ConversationRepository queries must complete within 100ms |
| Performance | Map extraction <200ms | StructuredMapExtractor must process single entry within 200ms |
| Reliability | Zero data loss on migration | Additive-only schema changes, never DROP or ALTER existing columns |
| Reliability | Idempotent operations | Backfill script and migrations safe to run multiple times |
| Scalability | Support 1000+ entries | Performance targets must hold with large knowledge bases |
| Compatibility | No breaking changes | All 14 existing MCP tools must continue working unchanged |
| Testability | ≥80% code coverage | All new code must have unit tests with ≥80% coverage |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-110 | KB System Upgrade v0.6.0 | In Progress | Epic | Main ticket |
| KSA-111 | [F1] Core/Archival Memory - Pinned Entries + Auto-Recall | To Do | Task | Child of KSA-110 |
| KSA-112 | [F3] Structured Map - Entity Extraction + Metadata Enrichment | To Do | Task | Child of KSA-110 |
| KSA-113 | [F2] Structured Conversation History | To Do | Task | Child of KSA-110 |
| KSA-114 | [Integration] Cross-Feature Integration + Polish v0.6.0 | To Do | Task | Child of KSA-110 |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| MCP | Model Context Protocol — protocol for AI agent tool communication |
| KB | Knowledge Base — the memory system for AI agents |
| Pinned Entry | A knowledge entry marked for automatic context injection |
| Structured Map | JSON metadata extracted from entry content (entities, decisions, etc.) |
| FTS5 | SQLite Full-Text Search extension version 5 |
| Token Budget | Maximum token count allowed for pinned entries (~2000 tokens) |
| Auto-Recall | Automatic injection of pinned entries into search results |
| Backfill | Process of extracting structured maps for existing entries |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| KB Upgrade Implementation Plan | documents/KB-UPGRADE-PLAN.md |
| Current Source Code | mcp-code-intelligence-nodejs/src/memory/ |
| Existing Schema | src/memory/schema.ts, src/memory/schema-v2.ts |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
