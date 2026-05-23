# Functional Specification Document (FSD)

## mcp-code-intelligence-nodejs — KSA-110: KB System Upgrade v0.6.0

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-110 |
| Title | KB System Upgrade v0.6.0 |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2025-05-22 |
| Status | Draft |
| Related BRD | BRD-v1.1-KSA-110.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-05-22 | BA Agent | Initiate document from BRD v1.1 (15 stories, 4 features) |
| 1.0 | 2025-05-22 | TA Agent | Enriched with API contracts, pseudocode, technical review |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the KB System Upgrade v0.6.0 for mcp-code-intelligence-nodejs. It covers 4 features:
- **F1** Core/Archival Memory (Pinned Entries + Auto-Recall)
- **F2** Structured Conversation History
- **F3** Structured Map (Entity Extraction + Metadata Enrichment)
- **F4** KB Anti-Pattern Protection

### 1.2 Scope

Upgrade from v0.5.1 to v0.6.0 adding 3 new MCP tools (`mem_pin`, `mem_conversation`, `mem_map`), schema migrations, token counting, conversation summarizer, structured map extractor, backfill script, and F4 anti-pattern protection mechanisms (agent isolation, blind retrieval prevention, ingest quality gate, search token budget, WORKING auto-expiry).

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| MCP | Model Context Protocol — protocol for AI agent tool communication |
| KB | Knowledge Base — the memory system for AI agents |
| Pinned Entry | A knowledge entry marked for automatic context injection |
| Structured Map | JSON metadata extracted from entry content (entities, decisions, etc.) |
| FTS5 | SQLite Full-Text Search extension version 5 |
| Token Budget | Maximum token count allowed for pinned entries (~2000 tokens) |
| Auto-Recall | Automatic injection of pinned entries into search results |
| WORKING Tier | Short-term memory tier for ephemeral/in-progress knowledge |
| EPISODIC Tier | Medium-term memory tier for session-specific knowledge |
| RLS | Row-Level Security — tag-based access filtering per agent role |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD v1.1 | documents/KSA-110/BRD.md |
| KB Discussion | documents/KSA-110/KB-discussion.md |
| Current Schema | mcp-code-intelligence-nodejs/src/memory/schema.ts |
| Schema v2 | mcp-code-intelligence-nodejs/src/memory/schema-v2.ts |
| Schema v3 | mcp-code-intelligence-nodejs/src/memory/schema-v3.ts |
| Core Memory | mcp-code-intelligence-nodejs/src/memory/core-memory.ts |
| Conversation Repo | mcp-code-intelligence-nodejs/src/memory/conversation-repo.ts |
| Structured Map | mcp-code-intelligence-nodejs/src/memory/structured-map-extractor.ts |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

The KB system operates within the mcp-code-intelligence-nodejs MCP server. External actors:
- **AI Agent (Client)**: Calls MCP tools (`mem_pin`, `mem_conversation`, `mem_map`, `mem_search`, `mem_ingest`) via stdio
- **SQLite Database**: Persistent storage for knowledge entries, vectors, conversations, entity index
- **ONNX Runtime**: Embedding model (all-MiniLM-L6-v2, 384d) for vector search
- **Workspace Filesystem**: `.code-intel/index.db` database file

### 2.2 System Architecture

The upgrade adds 4 functional layers to the existing KB:

1. **Core Memory Layer (F1)** — `CoreMemoryManager` manages pinned entries, token budget, auto-recall injection
2. **Conversation Layer (F2)** — `ConversationRepository` stores structured turns, session management, auto-summarization
3. **Structured Map Layer (F3)** — `StructuredMapExtractor` + `EntityRepository` for metadata enrichment and entity-based search
4. **Anti-Pattern Protection Layer (F4)** — Agent isolation (tag filter), blind retrieval prevention, ingest quality gate, search token budget, WORKING auto-expiry

All layers share the same SQLite database and are accessed via MCP tool dispatchers.

---

## 3. Functional Requirements

### 3.1 Feature F1: Core/Archival Memory (Pinned Entries + Auto-Recall)

**Source:** BRD Stories 1, 2, 3

#### 3.1.1 Description

Agents can pin critical knowledge entries for automatic context injection every turn. Pinned entries are prepended to `mem_search` results without requiring explicit search. A token budget (default 2000) prevents context window overflow.

#### 3.1.2 Use Case: UC-01 — Pin a Knowledge Entry

**Use Case ID:** UC-01
**Actor:** AI Agent
**Preconditions:** Knowledge entry exists in KB with valid ID
**Postconditions:** Entry marked as pinned, pin_order assigned, token budget updated

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls `mem_pin(action: "pin", entry_id: 42)` | | Agent requests to pin entry |
| 2 | | Validate entry exists | System checks knowledge_entries table |
| 3 | | Calculate token cost: `content.length / 4` | System computes tokens needed |
| 4 | | Check budget: `current_usage + cost ≤ 2000` | System enforces token budget |
| 5 | | Check cap: `pinned_count < 10` | System enforces max pinned entries |
| 6 | | Set `pinned=1`, assign `pin_order=next_available` | System updates entry |
| 7 | | Return success with budget info | System confirms pin |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01a | Entry already pinned | Return current pin status, no change |
| AF-01b | Agent specifies custom pin_order | Reorder existing entries to accommodate |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01a | Entry ID not found | Return error: "Entry {id} not found" |
| EF-01b | Token budget exceeded | Return error: "Token budget exceeded. Current: {current}/2000. Entry requires {needed} tokens." |
| EF-01c | Max pinned (10) reached | Return error: "Maximum pinned entries (10) reached. Unpin an entry first." |

#### 3.1.3 Use Case: UC-02 — Manage Pinned Entries

**Use Case ID:** UC-02
**Actor:** AI Agent
**Preconditions:** At least one pinned entry exists
**Postconditions:** Pin state updated per action

**Main Flow (Unpin):**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls `mem_pin(action: "unpin", entry_id: 42)` | | Agent requests unpin |
| 2 | | Set `pinned=0`, clear `pin_order` | System removes pin |
| 3 | | Reorder remaining: close gaps in pin_order | System maintains contiguous ordering |
| 4 | | Return updated pin list | System confirms |

**Main Flow (List):**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls `mem_pin(action: "list")` | | Agent requests pin list |
| 2 | | Query all entries WHERE pinned=1 ORDER BY pin_order | System fetches |
| 3 | | Calculate token count per entry + total | System computes budget |
| 4 | | Return list with: id, summary, pin_order, tokens, total_budget_used | System responds |

**Main Flow (Reorder):**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls `mem_pin(action: "reorder", entry_id: 42, order: 0)` | | Agent requests reorder |
| 2 | | Validate new order is valid (0 ≤ order < pinned_count) | System validates |
| 3 | | Shift other entries' pin_order to accommodate | System reorders |
| 4 | | Return updated pin list | System confirms |

**Main Flow (Get Context):**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls `mem_pin(action: "get_context")` | | Agent requests formatted context |
| 2 | | Fetch all pinned entries in pin_order | System queries |
| 3 | | Format as injection-ready text block | System formats |
| 4 | | Return formatted context + token count | System responds |

#### 3.1.4 Use Case: UC-03 — Auto-Recall on Search

**Use Case ID:** UC-03
**Actor:** AI Agent (implicit — triggered by mem_search)
**Preconditions:** Agent has pinned entries; agent calls `mem_search`
**Postconditions:** Search results include pinned entries prepended

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls `mem_search(query: "auth patterns")` | | Normal search |
| 2 | | Fetch pinned entries (CoreMemoryManager.getContext()) | System loads pins |
| 3 | | Execute normal hybrid search | System searches |
| 4 | | Prepend pinned entries to results (marked as `[PINNED]`) | System merges |
| 5 | | Return combined results | System responds |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-03a | No pinned entries | Return normal search results only |
| AF-03b | Pinned entries + F3 entity match | Boost pinned entries matching query entities |

#### 3.1.5 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-F1-01 | Maximum 10 pinned entries allowed | BRD Story 1 |
| BR-F1-02 | Total pinned content ≤ 2000 tokens (chars/4) | BRD Story 3 |
| BR-F1-03 | Pin order must be contiguous (no gaps after unpin) | BRD Story 2 |
| BR-F1-04 | Warning at 90% budget (1800 tokens) | BRD Story 3 |
| BR-F1-05 | Pinned entries exempt from WORKING tier auto-expiry | BRD Story 15 |
| BR-F1-06 | Cannot pin non-existent entry | BRD Story 1 |

#### 3.1.6 Data Specifications

**Input Data (mem_pin tool):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| action | string | Yes | enum: pin, unpin, list, reorder, get_context, budget | Operation to perform |
| entry_id | integer | Conditional | Must exist in knowledge_entries | Required for pin/unpin/reorder |
| order | integer | Conditional | 0 ≤ order < pinned_count | Required for reorder |

**Output Data (pin action):**

| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Whether operation succeeded |
| entry_id | integer | Pinned entry ID |
| pin_order | integer | Assigned order |
| tokens | integer | Token cost of this entry |
| budget_used | integer | Total tokens used across all pins |
| budget_max | integer | Maximum token budget (2000) |

**Output Data (list action):**

| Field | Type | Description |
|-------|------|-------------|
| entries | array | List of pinned entries |
| entries[].id | integer | Entry ID |
| entries[].summary | string | First 100 chars of content |
| entries[].pin_order | integer | Display order |
| entries[].tokens | integer | Token cost |
| total_tokens | integer | Sum of all pinned entry tokens |
| budget_max | integer | Maximum budget (2000) |
| budget_remaining | integer | Remaining budget |

#### 3.1.7 API Contract (Functional View)

**Tool:** `mem_pin`
**Purpose:** Manage pinned/archival memory entries for automatic context injection

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| action | string | Yes | Must be valid action | pin, unpin, list, reorder, get_context, budget |
| entry_id | integer | For pin/unpin/reorder | BR-F1-06: must exist | Target entry ID |
| order | integer | For reorder | 0 ≤ order < count | New position |

**Output Data (get_context):**

| Field | Type | Description |
|-------|------|-------------|
| context | string | Formatted pinned content ready for injection |
| tokens_used | integer | Total tokens in context |
| entries_count | integer | Number of pinned entries |

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| Entry not found | "Entry {id} not found" | entry_id doesn't exist in DB |
| Budget exceeded | "Token budget exceeded. Current: {n}/2000. Entry requires {m} tokens." | Pin would exceed 2000 tokens |
| Max entries reached | "Maximum pinned entries (10) reached. Unpin an entry first." | Already 10 pinned entries |
| Invalid action | "Invalid action. Must be: pin, unpin, list, reorder, get_context, budget" | Unknown action string |

---

### 3.2 Feature F2: Structured Conversation History

**Source:** BRD Stories 4, 5

#### 3.2.1 Description

Conversations are stored as structured JSON turns (role, content, tool_calls, metadata) in a dedicated `conversation_turns` table. Supports query by session, time range, and content search. Auto-summarization compresses old sessions into knowledge entries.

#### 3.2.2 Use Case: UC-04 — Save Conversation Turn

**Use Case ID:** UC-04
**Actor:** AI Agent
**Preconditions:** Valid session_id provided
**Postconditions:** Turn persisted in conversation_turns table

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls `mem_conversation(action: "save_turn", session_id: "sess_abc", role: "user", content: "Search for auth patterns")` | | Agent saves turn |
| 2 | | Validate role ∈ {user, assistant, system, tool} | System validates |
| 3 | | Assign turn_number = max(turn_number) + 1 for session | System auto-increments |
| 4 | | Insert into conversation_turns with timestamp | System persists |
| 5 | | Return turn_id and turn_number | System confirms |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-04a | tool_calls provided (JSON array) | Store in tool_calls column as JSON text |
| AF-04b | First turn in new session | Create session implicitly, turn_number = 1 |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-04a | Invalid role | Return error: "Invalid role. Must be: user, assistant, system, tool" |
| EF-04b | Empty content | Return error: "Content cannot be empty" |

#### 3.2.3 Use Case: UC-05 — Query Conversations

**Use Case ID:** UC-05
**Actor:** AI Agent
**Preconditions:** Conversations exist in DB
**Postconditions:** Matching turns returned

**Main Flow (get_session):**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls `mem_conversation(action: "get_session", session_id: "sess_abc")` | | Agent queries session |
| 2 | | Query conversation_turns WHERE session_id = ? ORDER BY turn_number | System fetches |
| 3 | | Return array of turns with all fields | System responds |

**Main Flow (list_sessions):**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls `mem_conversation(action: "list_sessions")` | | Agent lists sessions |
| 2 | | Query DISTINCT session_id with first/last timestamp, turn count | System aggregates |
| 3 | | Return session list ordered by most recent | System responds |

**Main Flow (search):**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls `mem_conversation(action: "search", query: "database migration")` | | Agent searches |
| 2 | | FTS5 search on conversation_turns content | System searches |
| 3 | | Return matching turns with session context | System responds |

#### 3.2.4 Use Case: UC-06 — Auto-Summarize Session

**Use Case ID:** UC-06
**Actor:** System (triggered on session end or threshold)
**Preconditions:** Session has turns older than configurable threshold (default: 7 days)
**Postconditions:** Summary entry created, original turns marked as summarized

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Detect session end or age threshold reached | System triggers |
| 2 | | Collect all turns for session | System fetches |
| 3 | | Extract: key decisions, action items, topics discussed | System summarizes |
| 4 | | Create knowledge entry (type: CONVERSATION, tags: "conversation, summary") | System stores |
| 5 | | Mark original turns: summarized = 1 | System flags |
| 6 | | Return summary entry ID | System confirms |

**Business Rules:**

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-F2-01 | Turns stored with role, content, tool_calls, metadata, timestamp | BRD Story 4 |
| BR-F2-02 | Valid roles: user, assistant, system, tool | BRD Story 4 |
| BR-F2-03 | Summarization preserves original turns (never deletes) | BRD Story 5 |
| BR-F2-04 | Summary captures: decisions, action items, topics | BRD Story 5 |
| BR-F2-05 | Query by session returns turns in turn_number order | BRD Story 4 |

#### 3.2.5 Data Specifications

**Input Data (mem_conversation tool):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| action | string | Yes | enum: save_turn, get_session, list_sessions, search, summarize | Operation |
| session_id | string | For save_turn/get_session | Non-empty string | Session identifier |
| role | string | For save_turn | enum: user, assistant, system, tool | Speaker role |
| content | string | For save_turn | Non-empty, max 50000 chars | Turn content |
| tool_calls | string | No | Valid JSON array | Tool calls made (JSON) |
| query | string | For search | Non-empty | Search query |
| limit | integer | No | 1-100, default 20 | Max results |

**Output Data (get_session):**

| Field | Type | Description |
|-------|------|-------------|
| session_id | string | Session identifier |
| turns | array | Ordered list of turns |
| turns[].turn_number | integer | Sequential number |
| turns[].role | string | Speaker role |
| turns[].content | string | Turn content |
| turns[].tool_calls | array/null | Tool calls if any |
| turns[].timestamp | string | ISO 8601 timestamp |
| total_turns | integer | Total turns in session |

#### 3.2.6 API Contract (Functional View)

**Tool:** `mem_conversation`
**Purpose:** Store and query structured conversation history

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| action | string | Yes | Valid action | save_turn, get_session, list_sessions, search, summarize |
| session_id | string | Conditional | BR-F2-01 | Required for save_turn, get_session |
| role | string | Conditional | BR-F2-02 | Required for save_turn |
| content | string | Conditional | Non-empty | Required for save_turn, search |
| tool_calls | string | No | Valid JSON | Optional for save_turn |
| limit | integer | No | 1-100 | Max results for list/search |

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| Invalid role | "Invalid role. Must be: user, assistant, system, tool" | role not in allowed set |
| Empty content | "Content cannot be empty" | content is empty/null for save_turn |
| Session not found | "Session '{id}' not found" | get_session with non-existent session |
| Invalid JSON tool_calls | "tool_calls must be a valid JSON array" | Malformed JSON |

---

### 3.3 Feature F3: Structured Map (Entity Extraction + Metadata Enrichment)

**Source:** BRD Stories 6, 7, 8

#### 3.3.1 Description

Every knowledge entry is automatically enriched with a `structured_map` containing extracted metadata: topic, entities_mentioned, decisions_made, action_items, context_refs, sentiment. Extraction is rule-based (no LLM). An `entity_index` table enables fast entity-based search.

#### 3.3.2 Use Case: UC-07 — Auto-Extract Structured Map on Ingest

**Use Case ID:** UC-07
**Actor:** System (triggered by mem_ingest)
**Preconditions:** New content being ingested via `mem_ingest`
**Postconditions:** structured_map populated, entity_index updated

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls `mem_ingest(content: "...")` | | Normal ingest |
| 2 | | Extract topic: first heading or first sentence | System extracts |
| 3 | | Extract entities: regex for `[A-Z]+-\d+` (tickets), file paths, @mentions, PascalCase names | System extracts |
| 4 | | Extract decisions: lines with "Decision:", "Decided:", "We will", "Chosen approach" | System extracts |
| 5 | | Extract action_items: lines with "TODO", "Action:", "Next step:", checkbox `[ ]` | System extracts |
| 6 | | Extract context_refs: URLs, file paths, ticket IDs | System extracts |
| 7 | | Calculate sentiment: keyword scoring (positive/negative word lists) | System scores |
| 8 | | Store structured_map as JSON in knowledge_entries | System persists |
| 9 | | Insert entities into entity_index with type classification | System indexes |
| 10 | | Return entry with structured_map | System responds |

**Entity Classification Rules:**

| Pattern | Entity Type | Examples |
|---------|-------------|---------|
| `[A-Z]+-\d+` | ticket | KSA-110, MTO-25 |
| `@\w+` | person | @ducnguyen, @team |
| PascalCase (2+ capitals) | system | AuthService, CoreMemory |
| Path with `/` or `\` | file | src/memory/schema.ts |
| URL (http/https) | url | https://github.com/... |
| Other capitalized words | concept | SQLite, ONNX, MCP |

#### 3.3.3 Use Case: UC-08 — Search by Entity/Topic

**Use Case ID:** UC-08
**Actor:** AI Agent
**Preconditions:** Entries exist with structured_map populated
**Postconditions:** Matching entries returned

**Main Flow (search_entity):**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls `mem_map(action: "search_entity", entity: "KSA-110")` | | Agent searches by entity |
| 2 | | Query entity_index WHERE entity_name = ? | System looks up |
| 3 | | Join with knowledge_entries to get full entries | System fetches |
| 4 | | Return entries mentioning this entity | System responds |

**Main Flow (search_topic):**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls `mem_map(action: "search_topic", topic: "authentication")` | | Agent searches by topic |
| 2 | | FTS5 search on structured_map.topic field | System searches |
| 3 | | Return matching entries ranked by relevance | System responds |

**Main Flow (get):**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls `mem_map(action: "get", entry_id: 42)` | | Agent gets map |
| 2 | | Fetch structured_map for entry | System queries |
| 3 | | Return full structured_map JSON | System responds |

**Main Flow (update):**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls `mem_map(action: "update", entry_id: 42, map: {...})` | | Agent updates map |
| 2 | | Merge provided map fields with existing structured_map | System merges |
| 3 | | Re-index entities if entities_mentioned changed | System re-indexes |
| 4 | | Return updated structured_map | System responds |

#### 3.3.4 Use Case: UC-09 — Backfill Existing Entries

**Use Case ID:** UC-09
**Actor:** System Administrator (via script)
**Preconditions:** Existing entries without structured_map
**Postconditions:** All entries have structured_map, entity_index populated

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Admin runs backfill script | | Manual trigger |
| 2 | | Query all entries WHERE structured_map IS NULL | System finds unprocessed |
| 3 | | For each entry: run StructuredMapExtractor | System extracts |
| 4 | | Update entry with structured_map | System persists |
| 5 | | Insert entities into entity_index | System indexes |
| 6 | | Report progress: {processed}/{total} | System reports |

**Business Rules:**

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-F3-01 | Extraction is rule-based only (no LLM calls) | BRD Story 6 |
| BR-F3-02 | Backfill is non-destructive (never modifies original content) | BRD Story 8 |
| BR-F3-03 | Backfill is idempotent (safe to run multiple times) | BRD Story 8 |
| BR-F3-04 | Entity types: ticket, person, system, file, url, concept | BRD Story 6 |
| BR-F3-05 | Extraction must complete <200ms per entry | BRD Story 10 |

#### 3.3.5 Data Specifications

**Structured Map Schema:**

| Field | Type | Description | Extraction Method |
|-------|------|-------------|-------------------|
| topic | string | Main topic of entry | First heading or first sentence |
| entities_mentioned | array[string] | Named entities found | Regex patterns (see UC-07) |
| decisions_made | array[string] | Decisions recorded | Line prefix matching |
| action_items | array[string] | TODOs and next steps | Line prefix + checkbox matching |
| context_refs | array[string] | URLs, paths, ticket IDs | URL/path/ticket regex |
| sentiment | string | Overall sentiment | Keyword scoring: positive/negative/neutral |

**Entity Index Table:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | INTEGER | Yes (PK) | Auto-increment |
| entry_id | INTEGER | Yes (FK) | Reference to knowledge_entries |
| entity_name | TEXT | Yes | The entity string |
| entity_type | TEXT | Yes | Classification (ticket/person/system/file/url/concept) |
| created_at | TEXT | Yes | ISO 8601 timestamp |

#### 3.3.6 API Contract (Functional View)

**Tool:** `mem_map`
**Purpose:** View and manage structured metadata for knowledge entries

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| action | string | Yes | Valid action | get, update, search_entity, search_topic, reextract |
| entry_id | integer | For get/update/reextract | Must exist | Target entry |
| entity | string | For search_entity | Non-empty | Entity name to search |
| topic | string | For search_topic | Non-empty | Topic to search |
| map | object | For update | Valid JSON object | Partial map to merge |
| limit | integer | No | 1-50, default 10 | Max results |

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| Entry not found | "Entry {id} not found" | entry_id doesn't exist |
| No structured_map | "Entry {id} has no structured map. Run reextract." | Entry predates F3, not backfilled |
| Invalid map format | "Map must be a JSON object with valid fields" | Non-object or unknown fields |

---

### 3.4 Feature F4: KB Anti-Pattern Protection

**Source:** BRD Stories 11, 12, 13, 14, 15

#### 3.4.1 Description

Prevents common KB anti-patterns that waste tokens: blind retrieval (searching KB when not needed), KB pollution (storing low-quality data), cross-domain noise (agents seeing irrelevant entries), unbounded search results, and stale WORKING tier accumulation.

#### 3.4.2 Use Case: UC-10 — Agent-Level KB Isolation (Tag-Based Filtering)

**Use Case ID:** UC-10
**Actor:** AI Agent with specific role
**Preconditions:** Agent scope mapping configured; entries have tags
**Postconditions:** Search results filtered to agent's domain

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls `mem_search(query: "...", agent_scope: "QA")` | | Agent searches with scope |
| 2 | | Look up agent scope mapping: QA → ["testing", "qa", "test-plan", "test-case"] | System resolves tags |
| 3 | | Add tag filter to search query: entries must have ≥1 matching tag | System filters |
| 4 | | Execute hybrid search with tag filter applied at query level | System searches |
| 5 | | Return filtered results (only domain-relevant entries) | System responds |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-10a | agent_scope not provided | No filtering, return all results (backward compatible) |
| AF-10b | Entry has no tags | Entry visible to all agents regardless of scope |
| AF-10c | Unknown agent_scope value | Return warning + unfiltered results |

**Agent Scope Mapping (Configurable):**

| Agent Role | Tag Set |
|-----------|---------|
| QA | testing, qa, test-plan, test-case, bug |
| DEV | code, api, architecture, implementation, design |
| BA | requirement, business, stakeholder, process |
| SA | architecture, design, infrastructure, security |
| DevOps | deployment, infrastructure, ci-cd, monitoring |

**Business Rules:**

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-F4-01 | Agent scope mapping is configurable (not hardcoded) | BRD Story 11 |
| BR-F4-02 | Untagged entries visible to all agents | BRD Story 11 |
| BR-F4-03 | Filter applied at query level (not post-filter) for performance | BRD Story 11 |
| BR-F4-04 | No performance degradation from filtering | BRD Story 11 |

#### 3.4.3 Use Case: UC-11 — Blind Retrieval Prevention

**Use Case ID:** UC-11
**Actor:** System (steering rule enforcement)
**Preconditions:** Agent about to perform a task
**Postconditions:** KB search only triggered when genuinely needed

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent receives task | | Task arrives |
| 2 | | Evaluate task against conditional search rules | System checks |
| 3 | | If task requires historical context → allow KB search | System permits |
| 4 | | If task is self-contained → skip KB search | System prevents |
| 5 | | Log retrieval_reason in audit trail | System audits |

**Conditional Search Rules:**

| Condition | Search Required? | Reason |
|-----------|-----------------|--------|
| Task references existing architecture decisions | YES | Need historical context |
| Task references previous implementations | YES | Need code patterns |
| Task involves entities/tickets discussed before | YES | Need prior discussions |
| Task is simple/self-contained (typo fix, format) | NO | Full context in prompt |
| Task has complete context in current prompt | NO | No additional info needed |
| Task is greenfield (no history exists) | NO | Nothing to retrieve |

**Implementation:**

| Component | Change | Description |
|-----------|--------|-------------|
| Steering rule `agent-self-learning` | Update | Replace "always search KB" with conditional logic |
| `mem_search` response | Add field | Include `retrieval_reason` metadata |
| Audit log | Add field | Record why search was/wasn't triggered |

**Business Rules:**

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-F4-05 | KB search only when task genuinely requires historical context | BRD Story 12 |
| BR-F4-06 | Each search must log retrieval_reason for audit | BRD Story 12 |
| BR-F4-07 | Target: ≥30% reduction in unnecessary KB calls | BRD Story 12 |

#### 3.4.4 Use Case: UC-12 — Ingest Quality Gate

**Use Case ID:** UC-12
**Actor:** System (triggered by mem_ingest)
**Preconditions:** Content submitted for ingestion
**Postconditions:** Content accepted, rejected, or flagged based on quality

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls `mem_ingest(content: "...")` | | Normal ingest |
| 2 | | Check minimum length: content.length ≥ 50 chars | System validates |
| 3 | | Check duplicates: cosine similarity with existing entries | System deduplicates |
| 4 | | If similarity > 0.95 → reject as duplicate | System rejects |
| 5 | | Calculate quality score (0-100) | System scores |
| 6 | | If score < 30 → reject automatically | System rejects |
| 7 | | If score 30-50 → accept with warning flag | System warns |
| 8 | | If score > 50 → accept normally | System accepts |
| 9 | | Proceed with normal ingest pipeline | System stores |

**Quality Score Calculation:**

| Factor | Points | Condition |
|--------|--------|-----------|
| Content length | 0-30 | Linear scale: 50 chars = 0, 500+ chars = 30 |
| Has tags specified | +20 | type or tags parameter provided |
| Has source reference | +10 | source parameter provided |
| Has structured data | +10 | Content has headings, lists, or code blocks |
| Duplicate penalty | -50 | Cosine similarity > 0.90 with existing entry |
| Contradiction flag | -20 | Contradicts existing entry on same topic |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-12a | Duplicate detected (>0.95 similarity) | Return error with existing entry ID, suggest merge |
| AF-12b | Near-duplicate (0.90-0.95) | Accept with warning, suggest review |
| AF-12c | Contradiction detected | Accept with flag, notify for review |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-12a | Content < 50 chars | Return error: "Content too short (minimum 50 characters). Provide more detail." |
| EF-12b | Quality score < 30 | Return error: "Content quality too low (score: {n}/100). Add tags, source, or more detail." |

**Business Rules:**

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-F4-08 | Minimum content length: 50 characters | BRD Story 13 |
| BR-F4-09 | Duplicate threshold: cosine similarity > 0.95 | BRD Story 13 |
| BR-F4-10 | Auto-reject threshold: quality score < 30 | BRD Story 13 |
| BR-F4-11 | Warning threshold: quality score 30-50 | BRD Story 13 |
| BR-F4-12 | No false positives on legitimate short entries (decisions) | BRD Story 13 |

#### 3.4.5 Use Case: UC-13 — Search Token Budget (max_tokens)

**Use Case ID:** UC-13
**Actor:** AI Agent
**Preconditions:** Agent calls mem_search
**Postconditions:** Results capped to token budget

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls `mem_search(query: "...", max_tokens: 1500)` | | Agent searches with budget |
| 2 | | Execute normal hybrid search, get ranked results | System searches |
| 3 | | Calculate tokens for each result: content.length / 4 | System counts |
| 4 | | Accumulate results until budget reached | System limits |
| 5 | | If single result exceeds remaining budget → truncate content | System truncates |
| 6 | | Add metadata: tokens_used, tokens_budget | System annotates |
| 7 | | Return budget-constrained results | System responds |

**Truncation Strategy:**

| Priority | Action | When |
|----------|--------|------|
| 1 | Limit number of results | Total tokens > budget |
| 2 | Truncate individual result content | Single result > remaining budget |
| 3 | Return summary instead of full content | Single result > entire budget |

**Output Metadata:**

| Field | Type | Description |
|-------|------|-------------|
| tokens_used | integer | Actual tokens in response |
| tokens_budget | integer | Budget that was applied |
| results_truncated | boolean | Whether any results were truncated |
| total_matches | integer | Total matches before budget limiting |

**Business Rules:**

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-F4-13 | Default max_tokens: 2000 when not specified | BRD Story 14 |
| BR-F4-14 | Higher-ranked results prioritized (never truncate rank 1 for rank 5) | BRD Story 14 |
| BR-F4-15 | Token counting: chars / 4 (same method as F1) | BRD Story 14 |
| BR-F4-16 | No significant performance overhead from token counting | BRD Story 14 |

#### 3.4.6 Use Case: UC-14 — WORKING Tier Auto-Expiry

**Use Case ID:** UC-14
**Actor:** System (lazy evaluation on mem_search)
**Preconditions:** WORKING tier entries older than 24h exist
**Postconditions:** Stale entries promoted or archived

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Any agent calls `mem_search(...)` | | Search triggers check |
| 2 | | Query WORKING tier entries WHERE created_at < NOW - 24h | System finds stale |
| 3 | | For each stale entry: check quality score | System evaluates |
| 4 | | If quality_score ≥ 60 → promote to EPISODIC tier | System promotes |
| 5 | | If quality_score < 60 → archive (soft delete) | System archives |
| 6 | | Skip entries with pinned = 1 | System exempts pins |
| 7 | | Log all actions to audit trail | System audits |
| 8 | | Continue with normal search | System proceeds |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-14a | No stale WORKING entries | Skip expiry, proceed with search |
| AF-14b | Entry is pinned | Skip (exempt from auto-expiry) |
| AF-14c | Expiry duration configured differently | Use configured duration instead of 24h |

**Business Rules:**

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-F4-17 | Default expiry: 24 hours | BRD Story 15 |
| BR-F4-18 | Promotion threshold: quality_score ≥ 60 | BRD Story 15 |
| BR-F4-19 | Archive = soft delete (recoverable) | BRD Story 15 |
| BR-F4-20 | Pinned entries exempt from auto-expiry | BRD Story 15 |
| BR-F4-21 | Lazy evaluation (runs on mem_search, not background job) | BRD Story 15 |
| BR-F4-22 | Audit trail for all auto-expiry actions | BRD Story 15 |

#### 3.4.7 API Contract Enhancements (Functional View)

**Enhanced Tool: `mem_search` (existing tool, new parameters)**

**New Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| agent_scope | string | No | BR-F4-01 | Agent role for tag-based filtering |
| max_tokens | integer | No | BR-F4-13, default 2000 | Token budget for results |

**New Output Fields:**

| Field | Type | Description |
|-------|------|-------------|
| tokens_used | integer | Tokens consumed by results |
| tokens_budget | integer | Budget applied |
| retrieval_reason | string | Why this search was triggered (audit) |
| results_truncated | boolean | Whether budget limiting was applied |
| expiry_actions | array | Auto-expiry actions taken during this search |

**Enhanced Tool: `mem_ingest` (existing tool, new behavior)**

**New Output Fields:**

| Field | Type | Description |
|-------|------|-------------|
| quality_score | integer | Calculated quality score (0-100) |
| quality_warning | string/null | Warning message if score 30-50 |
| duplicate_detected | boolean | Whether near-duplicate was found |
| structured_map | object | Auto-extracted metadata (from F3) |

---

### 3.5 Feature Integration: Cross-Feature Interactions

**Source:** BRD Story 9

#### 3.5.1 F1 + F3 Integration: Smart Auto-Recall

When `mem_search` is called:
1. Load pinned entries (F1)
2. Extract entities from search query (F3 extractor)
3. If pinned entries mention entities matching query → boost their relevance
4. Prepend pinned entries to results

#### 3.5.2 F1 + F4 Integration: Pin Exemption from Expiry

- Pinned entries (F1) are exempt from WORKING tier auto-expiry (F4)
- Pin budget check uses same token counting as search budget (F4)

#### 3.5.3 F3 + F4 Integration: Quality-Aware Extraction

- Ingest quality gate (F4) runs BEFORE structured map extraction (F3)
- If content rejected by quality gate → no extraction performed (saves compute)
- Quality score factors into WORKING tier expiry decision (F4)

#### 3.5.4 F2 + F3 Integration: Conversation Entity Indexing

- When conversation is summarized (F2), the summary entry gets structured_map extraction (F3)
- Entities mentioned in conversations become searchable via entity_index

---

## 4. Data Model

### 4.1 Entity Relationship Diagram

![ER Diagram](diagrams/er-diagram.png)

### 4.2 Logical Entities

#### Entity: knowledge_entries (Extended)

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| id | INTEGER | Yes (PK) | Auto-increment | Entry identifier |
| content | TEXT | Yes | BR-F4-08: ≥50 chars | Knowledge content |
| type | TEXT | No | | Entry type (DECISION, ERROR_PATTERN, etc.) |
| tier | TEXT | No | | WORKING, EPISODIC, SEMANTIC, PROCEDURAL |
| tags | TEXT | No | | Comma-separated tags |
| **pinned** | BOOLEAN | Yes | BR-F1-01: max 10 | NEW: Whether entry is pinned |
| **pin_order** | INTEGER | No | BR-F1-03: contiguous | NEW: Display/injection order |
| **structured_map** | TEXT (JSON) | No | BR-F3-01: rule-based | NEW: Extracted metadata JSON |
| **quality_score** | INTEGER | No | BR-F4-10: 0-100 | NEW: Content quality score |
| **archived** | BOOLEAN | No | BR-F4-19: soft delete | NEW: Archived flag |
| source | TEXT | No | | Source reference |
| created_at | TEXT | Yes | | ISO 8601 timestamp |
| updated_at | TEXT | Yes | | ISO 8601 timestamp |

#### Entity: conversation_turns (New)

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| id | INTEGER | Yes (PK) | Auto-increment | Turn identifier |
| session_id | TEXT | Yes | BR-F2-01 | Session identifier |
| turn_number | INTEGER | Yes | Auto-assigned | Sequential within session |
| role | TEXT | Yes | BR-F2-02: enum | user, assistant, system, tool |
| content | TEXT | Yes | Non-empty | Turn content |
| tool_calls | TEXT (JSON) | No | Valid JSON array | Tool calls made |
| metadata | TEXT (JSON) | No | Valid JSON object | Extra metadata |
| summarized | BOOLEAN | No | BR-F2-03 | Whether included in summary |
| created_at | TEXT | Yes | | ISO 8601 timestamp |

#### Entity: entity_index (New)

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| id | INTEGER | Yes (PK) | Auto-increment | Index entry ID |
| entry_id | INTEGER | Yes (FK) | References knowledge_entries | Parent entry |
| entity_name | TEXT | Yes | BR-F3-04 | Entity string |
| entity_type | TEXT | Yes | BR-F3-04: enum | ticket/person/system/file/url/concept |
| created_at | TEXT | Yes | | ISO 8601 timestamp |

#### Entity: agent_scope_config (New)

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| id | INTEGER | Yes (PK) | Auto-increment | Config entry ID |
| agent_role | TEXT | Yes | BR-F4-01: unique | Agent role name (QA, DEV, BA, SA, DevOps) |
| tag_set | TEXT (JSON) | Yes | BR-F4-01 | Array of allowed tags |
| updated_at | TEXT | Yes | | Last modified |

**Relationships:**

| From Entity | To Entity | Cardinality | Description |
|-------------|-----------|-------------|-------------|
| knowledge_entries | entity_index | 1:N | One entry can have many entities |
| knowledge_entries | conversation_turns | 1:1 | Summary entry links to session |
| agent_scope_config | knowledge_entries | 1:N | Scope filters entries by tags |

---

## 5. Integration Specifications

### 5.1 Internal Integration: Existing MCP Tools

| Attribute | Value |
|-----------|-------|
| Purpose | Ensure 14 existing tools continue working unchanged |
| Direction | Bidirectional |
| Data Format | JSON (MCP protocol) |
| Frequency | Real-time (every tool call) |

**Compatibility Matrix:**

| Existing Tool | F1 Impact | F2 Impact | F3 Impact | F4 Impact |
|---------------|-----------|-----------|-----------|-----------|
| mem_search | Pinned prepend | None | Entity boost | agent_scope + max_tokens + expiry |
| mem_ingest | None | None | Auto-extract map | Quality gate |
| mem_crud | Pin state in response | None | Map in response | Archived flag |
| mem_consolidate | Preserve pin state | None | Re-extract on merge | Quality re-score |
| mem_scoring | None | None | None | Quality score source |
| mem_lifecycle | Pin exempt | None | None | Expiry integration |
| mem_tags | None | None | None | Scope mapping source |
| mem_graph | None | None | Entity → graph link | None |
| mem_discover | Pin boost | None | Entity matching | None |
| mem_citations | None | None | None | None |
| mem_templates | None | None | None | None |
| mem_attachments | None | None | None | None |
| mem_admin | Pin stats | Session stats | Entity stats | Quality stats |
| mem_kb_export | Include pin state | None | Include map | Include quality |

### 5.2 Internal Integration: Schema Migrations

| Attribute | Value |
|-----------|-------|
| Purpose | Extend SQLite schema without breaking existing data |
| Direction | One-way (additive only) |
| Data Format | SQL DDL |
| Frequency | Once (on first startup after upgrade) |

**Migration Steps:**

| Order | Migration | Tables Affected | Reversible |
|-------|-----------|-----------------|------------|
| 1 | Add pinned, pin_order columns | knowledge_entries | Yes (columns nullable) |
| 2 | Add structured_map column | knowledge_entries | Yes (column nullable) |
| 3 | Add quality_score, archived columns | knowledge_entries | Yes (columns nullable) |
| 4 | Create conversation_turns table | New table | Yes (DROP TABLE) |
| 5 | Create entity_index table | New table | Yes (DROP TABLE) |
| 6 | Create agent_scope_config table | New table | Yes (DROP TABLE) |
| 7 | Create FTS5 index on entity_index | New index | Yes (DROP) |
| 8 | Create index on conversation_turns(session_id, turn_number) | New index | Yes (DROP) |

---

## 6. Processing Logic

### 6.1 Token Counting

**Trigger:** Every pin operation, every search with max_tokens
**Input:** Text content (string)
**Output:** Token count (integer)

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Receive content string | If null/undefined → return 0 |
| 2 | Calculate: Math.ceil(content.length / 4) | Integer overflow impossible (JS safe integer) |
| 3 | Return token count | N/A |

**Pseudocode:**
```typescript
function countTokens(content: string): number {
  if (!content) return 0;
  return Math.ceil(content.length / 4);
}
```

### 6.2 Structured Map Extraction

**Trigger:** Every `mem_ingest` call (after quality gate passes)
**Input:** Entry content (string)
**Output:** StructuredMap object

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Extract topic: first markdown heading (`# ...`) or first sentence | If no heading → use first 100 chars |
| 2 | Extract entities: apply regex patterns sequentially | If no matches → empty array |
| 3 | Classify entities by pattern match | Unknown patterns → type "concept" |
| 4 | Extract decisions: scan for decision keywords | If none → empty array |
| 5 | Extract action_items: scan for TODO/action keywords | If none → empty array |
| 6 | Extract context_refs: URLs + file paths + ticket IDs | If none → empty array |
| 7 | Calculate sentiment: count positive vs negative keywords | Default → "neutral" |
| 8 | Return StructuredMap JSON | On any error → return partial map |

**Pseudocode:**
```typescript
function extractStructuredMap(content: string): StructuredMap {
  const topic = extractTopic(content);  // first heading or first sentence
  const entities = extractEntities(content);  // regex-based
  const decisions = content.split('\n')
    .filter(line => /^(Decision:|Decided:|We will|Chosen approach)/i.test(line.trim()));
  const actionItems = content.split('\n')
    .filter(line => /^(TODO|Action:|Next step:|\- \[ \])/i.test(line.trim()));
  const contextRefs = [
    ...content.matchAll(/https?:\/\/[^\s)]+/g),
    ...content.matchAll(/[A-Z]+-\d+/g),
    ...content.matchAll(/[\w\/\\]+\.\w{1,5}/g)  // file paths
  ].map(m => m[0]);
  const sentiment = scoreSentiment(content);
  
  return { topic, entities_mentioned: entities.map(e => e.name),
           decisions_made: decisions, action_items: actionItems,
           context_refs: [...new Set(contextRefs)], sentiment };
}
```

### 6.3 Quality Score Calculation

**Trigger:** Every `mem_ingest` call (before storage)
**Input:** Content + metadata (tags, source, type)
**Output:** Quality score (0-100)

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Base score from content length: min(30, (length - 50) / 15) | Clamp to 0-30 |
| 2 | Add +20 if tags or type specified | Boolean check |
| 3 | Add +10 if source reference provided | Boolean check |
| 4 | Add +10 if content has structure (headings, lists, code) | Regex check |
| 5 | Check duplicates: cosine similarity with top-5 similar entries | If >0.95 → -50 penalty |
| 6 | Check near-duplicate: if 0.90-0.95 → -20 penalty | Warning flag |
| 7 | Clamp final score to 0-100 | Math.max(0, Math.min(100, score)) |
| 8 | Return score + decision (accept/warn/reject) | N/A |

**Pseudocode:**
```typescript
function calculateQualityScore(content: string, meta: IngestMeta): QualityResult {
  let score = 0;
  // Length score (0-30)
  score += Math.min(30, Math.max(0, (content.length - 50) / 15));
  // Metadata bonuses
  if (meta.tags || meta.type) score += 20;
  if (meta.source) score += 10;
  if (/^#{1,3}\s|^\-\s|```/.test(content)) score += 10;
  // Duplicate check
  const maxSimilarity = await findMaxSimilarity(content);
  if (maxSimilarity > 0.95) score -= 50;
  else if (maxSimilarity > 0.90) score -= 20;
  
  score = Math.max(0, Math.min(100, Math.round(score)));
  const decision = score < 30 ? 'reject' : score < 50 ? 'warn' : 'accept';
  return { score, decision, duplicate: maxSimilarity > 0.90 };
}
```

### 6.4 WORKING Tier Auto-Expiry

**Trigger:** Every `mem_search` call (lazy evaluation)
**Input:** Current timestamp
**Output:** List of expiry actions taken

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Query: SELECT * FROM knowledge_entries WHERE tier='WORKING' AND pinned=0 AND created_at < NOW-24h | If none → skip |
| 2 | For each stale entry: get quality_score | If null → treat as 0 |
| 3 | If quality_score ≥ 60 → UPDATE tier='EPISODIC' | Log promotion |
| 4 | If quality_score < 60 → UPDATE archived=1 | Log archive |
| 5 | Insert audit records for each action | On error → log but don't fail search |
| 6 | Return actions list | Empty if nothing expired |

**Pseudocode:**
```typescript
async function processWorkingExpiry(db: Database): Promise<ExpiryAction[]> {
  const threshold = Date.now() - (24 * 60 * 60 * 1000); // 24h
  const stale = db.prepare(`
    SELECT id, quality_score FROM knowledge_entries
    WHERE tier = 'WORKING' AND pinned = 0 AND archived = 0
    AND created_at < ?
  `).all(new Date(threshold).toISOString());
  
  const actions: ExpiryAction[] = [];
  for (const entry of stale) {
    if ((entry.quality_score ?? 0) >= 60) {
      db.prepare('UPDATE knowledge_entries SET tier = ? WHERE id = ?')
        .run('EPISODIC', entry.id);
      actions.push({ entry_id: entry.id, action: 'promoted', to: 'EPISODIC' });
    } else {
      db.prepare('UPDATE knowledge_entries SET archived = 1 WHERE id = ?')
        .run(entry.id);
      actions.push({ entry_id: entry.id, action: 'archived' });
    }
  }
  return actions;
}
```

### 6.5 Conversation Summarization

**Trigger:** Session end or manual `mem_conversation(action: "summarize")`
**Input:** All turns in a session
**Output:** Summary knowledge entry

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Fetch all turns for session ordered by turn_number | If empty → return error |
| 2 | Extract key decisions (lines with decision keywords) | If none → note "no decisions" |
| 3 | Extract action items (TODO, next step patterns) | If none → note "no actions" |
| 4 | Extract topics discussed (from assistant responses) | Use first sentences |
| 5 | Compose summary text with sections | Always produce output |
| 6 | Create knowledge entry (type: CONVERSATION, tags: "conversation,summary,{session_id}") | On error → retry once |
| 7 | Mark original turns: summarized = 1 | Batch update |
| 8 | Return summary entry ID | N/A |

---

## 7. Security Requirements

### 7.1 Authentication & Authorization

| Role | Permissions | Features |
|------|-------------|----------|
| AI Agent (any) | Read/Write KB entries | All MCP tools |
| AI Agent (scoped) | Read filtered by agent_scope | mem_search with tag filter |
| System | Auto-expiry, auto-extract | Background processes |

### 7.2 Data Sensitivity Classification

| Data Type | Classification | Business Requirement |
|-----------|---------------|---------------------|
| Knowledge entries | Internal | May contain project-specific decisions |
| Conversation turns | Internal | May contain user interactions |
| Entity index | Internal | Derived from content |
| Agent scope config | Internal | Configuration data |

### 7.3 Audit Trail

| Event | Logged Fields | Retention | Business Reason |
|-------|--------------|-----------|-----------------|
| Pin/Unpin | entry_id, action, timestamp, budget_state | Indefinite | Track context management |
| Quality rejection | content_hash, score, reason, timestamp | 30 days | Monitor false positives |
| Auto-expiry | entry_id, action (promote/archive), quality_score | Indefinite | Track data lifecycle |
| Search with scope | agent_scope, query, results_count, tokens_used | 7 days | Monitor isolation effectiveness |

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | Pin retrieval fast enough for every-turn injection | < 50ms for CoreMemoryManager.getContext() |
| Performance | Conversation queries responsive | < 100ms for ConversationRepository.getSession() |
| Performance | Entity search fast | < 100ms for entity_index lookup |
| Performance | Map extraction lightweight | < 200ms per entry (rule-based, no network) |
| Performance | Token counting negligible | < 1ms per call |
| Performance | Quality gate minimal overhead | < 50ms additional latency on ingest |
| Reliability | Zero data loss on migration | Additive-only schema changes |
| Reliability | Idempotent operations | Backfill + migrations safe to re-run |
| Scalability | Support 1000+ entries | Performance targets hold at scale |
| Compatibility | No breaking changes | All 14 existing MCP tools unchanged |
| Testability | High coverage | ≥ 80% code coverage on new code |

---

## 9. Error Handling (User-Facing)

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| Pin budget exceeded | Warning | "Token budget exceeded. Current: {n}/2000. Entry requires {m} tokens." | Agent unpins something first |
| Max pins reached | Warning | "Maximum pinned entries (10) reached. Unpin an entry first." | Agent manages pins |
| Quality rejection | Info | "Content quality too low (score: {n}/100). Add tags, source, or more detail." | Agent improves content |
| Duplicate detected | Warning | "Near-duplicate found (similarity: {n}%). Existing entry: #{id}. Consider merging." | Agent decides merge/skip |
| Content too short | Info | "Content too short (minimum 50 characters). Provide more detail." | Agent adds detail |
| Entry not found | Error | "Entry {id} not found" | Agent checks ID |
| Invalid role | Error | "Invalid role. Must be: user, assistant, system, tool" | Agent fixes role |
| Session not found | Warning | "Session '{id}' not found" | Agent checks session_id |
| Migration failure | Critical | "Schema migration failed: {detail}. Database unchanged." | Admin investigates |

### 9.2 Notification Requirements

| Event | Who is Notified | Channel | Timing |
|-------|----------------|---------|--------|
| Quality rejection | Calling agent | MCP response | Immediate |
| Auto-expiry actions | Audit log | Database | On next search |
| Migration success | System log | Console | On startup |
| Duplicate warning | Calling agent | MCP response | Immediate |

---

## 10. Testing Considerations

### 10.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-01 | Pin entry successfully | mem_pin(action:"pin", entry_id:1) | success=true, budget updated | High |
| TC-02 | Pin exceeds budget | Pin entry with 2100 tokens | Error: budget exceeded | High |
| TC-03 | Pin exceeds max count | Pin 11th entry | Error: max reached | High |
| TC-04 | Unpin reorders correctly | Unpin middle entry | Remaining entries reordered contiguously | High |
| TC-05 | Auto-recall prepends pins | mem_search with 3 pinned entries | Results start with [PINNED] entries | High |
| TC-06 | Save conversation turn | save_turn with all fields | Turn persisted, turn_number assigned | High |
| TC-07 | Query session returns ordered | get_session after 5 turns | 5 turns in order | High |
| TC-08 | Summarize session | summarize session with 10 turns | Summary entry created, turns marked | Medium |
| TC-09 | Extract entities from content | Content with ticket IDs, class names | Correct entities extracted and classified | High |
| TC-10 | Search by entity | search_entity("KSA-110") | All entries mentioning KSA-110 | High |
| TC-11 | Backfill idempotent | Run backfill twice | Same result, no duplicates | Medium |
| TC-12 | Agent scope filtering | mem_search with agent_scope:"QA" | Only QA-tagged entries returned | High |
| TC-13 | Untagged entries visible | Search with scope, untagged entry exists | Untagged entry included | High |
| TC-14 | Quality gate rejects short | Ingest 30-char content | Error: too short | High |
| TC-15 | Quality gate rejects duplicate | Ingest identical content | Error: duplicate detected | High |
| TC-16 | Search token budget | mem_search(max_tokens:500) | Results ≤ 500 tokens | High |
| TC-17 | WORKING auto-expiry promotes | WORKING entry, score=70, age=25h | Promoted to EPISODIC | High |
| TC-18 | WORKING auto-expiry archives | WORKING entry, score=20, age=25h | Archived | High |
| TC-19 | Pinned exempt from expiry | Pinned WORKING entry, age=48h | Not expired | High |
| TC-20 | Cross-feature: pin + search + scope | Pinned entry with QA tag, search with scope=DEV | Pinned entry still shown (pins bypass scope) | Medium |

---

## 11. Appendix

### 11.1 State Diagram: Knowledge Entry Lifecycle

![State Diagram](diagrams/state-entry-lifecycle.png)

States:
- **Ingested** → Quality gate passed, entry stored
- **Enriched** → Structured map extracted, entities indexed
- **Pinned** → Marked for auto-recall
- **Expired** → WORKING tier auto-expiry triggered
- **Promoted** → Moved from WORKING to EPISODIC
- **Archived** → Soft-deleted (recoverable)

### 11.2 Sequence Diagram: mem_search with All Features

![Sequence Diagram](diagrams/sequence-search-full.png)

Sequence:
1. Agent → mem_search(query, agent_scope, max_tokens)
2. System → processWorkingExpiry() [lazy]
3. System → CoreMemoryManager.getContext() [load pins]
4. System → HybridSearch.execute(query) [BM25 + vector]
5. System → applyAgentScope(results, scope) [tag filter]
6. System → applyTokenBudget(results, max_tokens) [truncate]
7. System → prependPinnedEntries(pins, results) [merge]
8. System → Agent: results + metadata

### 11.3 Sequence Diagram: mem_ingest with Quality Gate

![Sequence Diagram](diagrams/sequence-ingest-quality.png)

Sequence:
1. Agent → mem_ingest(content, tags, source)
2. System → validateMinLength(content) [≥50 chars]
3. System → calculateQualityScore(content, meta)
4. System → checkDuplicates(content) [cosine similarity]
5. If rejected → return error
6. System → extractStructuredMap(content) [F3]
7. System → indexEntities(map.entities) [F3]
8. System → store entry with quality_score + structured_map
9. System → Agent: entry + quality_score + structured_map

### 11.4 Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | ER Diagram | [er-diagram.png](diagrams/er-diagram.png) | [er-diagram.drawio](diagrams/er-diagram.drawio) |
| 3 | State: Entry Lifecycle | [state-entry-lifecycle.png](diagrams/state-entry-lifecycle.png) | [state-entry-lifecycle.drawio](diagrams/state-entry-lifecycle.drawio) |
| 4 | Sequence: Search Full | [sequence-search-full.png](diagrams/sequence-search-full.png) | [sequence-search-full.drawio](diagrams/sequence-search-full.drawio) |
| 5 | Sequence: Ingest Quality | [sequence-ingest-quality.png](diagrams/sequence-ingest-quality.png) | [sequence-ingest-quality.drawio](diagrams/sequence-ingest-quality.drawio) |

### 11.5 Change Log from BRD

| BRD Item | FSD Clarification |
|----------|-------------------|
| Story 11: "agent_scope parameter" | Clarified as optional parameter on existing mem_search tool (not new tool) |
| Story 12: "blind retrieval prevention" | Implemented as steering rule update + audit metadata (not code enforcement) |
| Story 13: "contradiction detection" | Simplified to cosine similarity check only (full contradiction detection deferred) |
| Story 14: "summary instead of full content" | Truncation strategy: limit results first, then truncate content, summary as last resort |
| Story 15: "lazy evaluation" | Runs on every mem_search call, not as background job |
| F1+F4 interaction | Pinned entries bypass agent_scope filter (always visible to pinning agent) |

### 11.6 Open Issues

| # | Issue | Impact | Proposed Resolution |
|---|-------|--------|---------------------|
| 1 | Should pinned entries bypass agent_scope? | If yes, agent sees pins regardless of role | Proposed: Yes — pins are intentional, agent chose to pin |
| 2 | Quality gate false positives on short decisions | Legitimate "Decision: use PostgreSQL" = 30 chars | Proposed: Exempt entries with type=DECISION from min-length |
| 3 | Auto-expiry during high-load search | Expiry adds latency to search | Proposed: Rate-limit expiry to max 10 entries per search call |
| 4 | Conversation summarization quality | Rule-based summary may miss nuance | Proposed: Accept for v0.6.0, add LLM-assisted in v0.7.0 |
