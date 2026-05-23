# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-142: Feature Parity Sync — Đồng bộ 3 MCP implementations (Python, Node.js, Kotlin)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-142 |
| Title | Feature Parity Sync — Đồng bộ 3 MCP implementations (Python, Node.js, Kotlin) |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-23 |
| Status | Draft |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | SA Agent – Solution Architect | Review technical feasibility |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-23 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-142 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

This change request implements **feature parity synchronization** across the 3 MCP Code Intelligence implementations (Python, Node.js, Kotlin). Currently, each implementation has unique features not available in the others, creating inconsistent developer experience. This CR ports missing features to achieve 100% feature parity.

**Key gaps to address:**
- **Python & Kotlin** lack: Core Memory (Pinned Entries), Conversation History, Structured Map & Entity Index (features from Node.js)
- **Node.js** lacks: Cache layer for orchestration, File Watcher (auto-reindex), Viewer UI (features from Python/Kotlin)
- **Kotlin** lacks: Nested Detection (detect child servers exposing find_tools)

### 1.2 Out of Scope

- Creating new features not present in any implementation (only porting existing features)
- Changing the MCP protocol specification
- Unifying the 3 implementations into a single codebase
- UI/UX redesign of the Viewer (only port existing Python UI)
- Performance optimization beyond what's needed for feature parity

### 1.3 Preliminary Requirement

- All 3 MCP implementations must be in a stable, working state
- Node.js implementation must have Core Memory, Conversation History, and Structured Map fully functional (reference for porting)
- Python implementation must have Cache layer and Viewer UI fully functional (reference for porting)
- KSA-139 (Cache layer related) should be completed or in progress

---

## 2. Business Requirements

### 2.1 High Level Process Map

The feature parity sync follows a **port-and-adapt** approach:

1. **Identify reference implementation** for each feature (the module that already has it)
2. **Analyze architecture patterns** of the target module (Python/Kotlin/Node.js)
3. **Port feature** following target module's conventions (not copy-paste)
4. **Validate parity** — ensure ported feature behaves identically to reference
5. **Integration test** — verify no regressions in existing features

### 2.2 List of User Stories / Use Cases

![Use Case Diagram](diagrams/use-case.png)

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a developer using Python/Kotlin MCP, I want Core Memory (pinned entries + auto-recall) so that important context is always available | MUST HAVE | KSA-142 |
| 2 | As a developer using Python/Kotlin MCP, I want Conversation History so that session context is preserved across interactions | MUST HAVE | KSA-142 |
| 3 | As a developer using Python/Kotlin MCP, I want Structured Map & Entity Index so that I can search and navigate knowledge by entities and topics | MUST HAVE | KSA-142 |
| 4 | As a developer using Node.js MCP, I want a Cache layer for orchestration so that repeated operations are faster | MUST HAVE | KSA-142 |
| 5 | As a developer using Node.js MCP, I want a File Watcher so that code index updates automatically when files change | SHOULD HAVE | KSA-142 |
| 6 | As a developer using Node.js/Kotlin MCP, I want a Viewer UI (web dashboard) so that I can visualize knowledge base state | COULD HAVE | KSA-142 |
| 7 | As a developer using Kotlin MCP, I want Nested Detection so that child MCP servers exposing find_tools are automatically discovered | SHOULD HAVE | KSA-142 |

---

### 2.3 Details of User Stories

---

#### Business Flow

![Business Flow](diagrams/business-flow.png)

**Step 1:** Developer identifies feature gap in their preferred MCP implementation

**Step 2:** Developer switches to the implementation that has the feature (current workaround)

**Step 3:** After parity sync, developer uses ANY implementation with full feature set

**Step 4:** All 3 implementations expose identical MCP tools (mem_pin, mem_conversation, mem_map, etc.)

**Step 5:** Developer experience is consistent regardless of which MCP server they connect to

> **Note:** The porting priority is HIGH for F1/F2/F3 (Core Memory, Conversation, Structured Map) because agents actively use these Node.js features. Cache layer for Node.js is also HIGH (related to KSA-139).

---

#### STORY 1: Core Memory (Pinned Entries + Auto-Recall) — Port to Python & Kotlin

> As a developer using Python/Kotlin MCP, I want Core Memory (pinned entries + auto-recall) so that important context is always available

**Requirement Details:**

1. Implement `mem_pin` tool with actions: pin, unpin, list, reorder, get_context, budget
2. Schema migration to add `pinned_entries` table (or equivalent) in Python/Kotlin DB
3. CoreMemoryManager class that manages pinned entries with 2000-token budget
4. Auto-recall hook: when agent starts a session, pinned entries are automatically included in context
5. Pin/unpin operations must be atomic and persist immediately

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| action | string | Yes | One of: pin, unpin, list, reorder, get_context, budget | `"pin"` |
| entry_id | number | No | Entry ID to pin/unpin/reorder | `42` |
| order | number | No | New position for reorder | `1` |

**Acceptance Criteria:**

1. Given Python/Kotlin MCP server running, when `mem_pin(action="pin", entry_id=42)` is called, then entry 42 is pinned and appears in auto-recall context
2. Given 5 pinned entries totaling 1800 tokens, when a 6th entry (300 tokens) is pinned, then system warns about budget overflow
3. Given pinned entries exist, when `mem_pin(action="get_context")` is called, then all pinned entries are returned in order within 2000-token budget
4. Given entry is pinned, when `mem_pin(action="unpin", entry_id=42)` is called, then entry is removed from auto-recall
5. Behavior MUST match Node.js reference implementation exactly

---

#### STORY 2: Conversation History — Port to Python & Kotlin

> As a developer using Python/Kotlin MCP, I want Conversation History so that session context is preserved across interactions

**Requirement Details:**

1. Implement `mem_conversation` tool with actions: save_turn, get_session, list_sessions, search, summarize
2. Schema migration to add `conversations` and `conversation_turns` tables
3. ConversationRepository class for CRUD operations on conversation data
4. Session-based grouping: turns belong to sessions, sessions have metadata
5. Summarizer: ability to generate session summaries for long conversations

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| action | string | Yes | One of: save_turn, get_session, list_sessions, search, summarize | `"save_turn"` |
| session_id | string | No | Session identifier | `"session-2026-05-23"` |
| role | string | No | Turn role: user, assistant, system, tool | `"user"` |
| content | string | No | Turn content | `"Find all TODO items"` |
| query | string | No | Search query for search action | `"authentication"` |
| tool_calls | string | No | JSON array of tool calls | `"[{\"name\":\"grep\"}]"` |

**Acceptance Criteria:**

1. Given a session, when `mem_conversation(action="save_turn", session_id="s1", role="user", content="hello")` is called, then turn is persisted
2. Given session with 10 turns, when `mem_conversation(action="get_session", session_id="s1")` is called, then all 10 turns are returned in order
3. Given multiple sessions, when `mem_conversation(action="list_sessions")` is called, then all sessions with metadata are listed
4. Given conversation content, when `mem_conversation(action="search", query="auth")` is called, then matching turns are returned
5. Behavior MUST match Node.js reference implementation exactly

---

#### STORY 3: Structured Map & Entity Index — Port to Python & Kotlin

> As a developer using Python/Kotlin MCP, I want Structured Map & Entity Index so that I can search and navigate knowledge by entities and topics

**Requirement Details:**

1. Implement `mem_map` tool with actions: get, update, search_entity, search_topic, reextract
2. Schema migration to add `structured_maps` and `entities` tables
3. StructuredMapExtractor class that extracts entities, topics, decisions, action items from content
4. EntityRepository for entity CRUD and relationship tracking
5. Search by entity name or topic with relevance ranking

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| action | string | Yes | One of: get, update, search_entity, search_topic, reextract | `"search_entity"` |
| entry_id | number | No | Entry ID for get/update/reextract | `15` |
| entity | string | No | Entity name to search | `"AuthService"` |
| topic | string | No | Topic to search | `"authentication"` |
| map | object | No | Partial StructuredMap to merge (for update) | `{"entities": ["UserRepo"]}` |

**Acceptance Criteria:**

1. Given knowledge entries exist, when `mem_map(action="search_entity", entity="AuthService")` is called, then all entries mentioning AuthService are returned
2. Given an entry, when `mem_map(action="get", entry_id=15)` is called, then its structured map (topic, entities, decisions, sentiment) is returned
3. Given an entry with outdated map, when `mem_map(action="reextract", entry_id=15)` is called, then map is regenerated from content
4. Given topic "authentication", when `mem_map(action="search_topic", topic="authentication")` is called, then relevant entries are ranked and returned
5. Behavior MUST match Node.js reference implementation exactly

---

#### STORY 4: Cache Layer for Orchestration — Port to Node.js

> As a developer using Node.js MCP, I want a Cache layer for orchestration so that repeated operations are faster

**Requirement Details:**

1. Implement `orchestration/cache/` module in Node.js (reference: Python & Kotlin implementations)
2. Cache strategy: LRU with TTL-based expiration
3. Cache targets: tool registry lookups, KB search results, code intelligence queries
4. Cache invalidation: on tool registry change, on KB ingest, on file change
5. Configurable cache size and TTL per cache type

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| cache_type | string | Yes | Type of cache: registry, kb_search, code_intel | `"registry"` |
| max_size | number | No | Maximum entries in cache | `1000` |
| ttl_seconds | number | No | Time-to-live in seconds | `300` |

**Acceptance Criteria:**

1. Given tool registry lookup performed, when same lookup is repeated within TTL, then cached result is returned (0ms vs original latency)
2. Given KB search performed, when same query is repeated, then cached result is returned
3. Given tool registry changes (new tool registered), then registry cache is invalidated
4. Given cache exceeds max_size, then LRU eviction removes oldest entries
5. Cache hit/miss metrics are logged for observability

---

#### STORY 5: File Watcher — Port to Node.js

> As a developer using Node.js MCP, I want a File Watcher so that code index updates automatically when files change

**Requirement Details:**

1. Implement file watcher using `chokidar` or native `fs.watch` in Node.js
2. Watch workspace source files for changes (create, modify, delete)
3. On change detected: trigger incremental re-index of affected file(s)
4. Debounce: batch changes within 500ms window before triggering re-index
5. Configurable watch patterns (include/exclude globs)
6. Graceful handling of large batch changes (e.g., git checkout)

**Acceptance Criteria:**

1. Given file watcher active, when a source file is modified, then code index is updated within 2 seconds
2. Given 50 files change simultaneously (git checkout), then re-index is batched (not 50 individual re-indexes)
3. Given file watcher configured to exclude `node_modules/`, when file in node_modules changes, then no re-index triggered
4. Given file watcher encounters permission error, then it logs warning and continues watching other files

---

#### STORY 6: Viewer UI (Web Dashboard) — Port to Node.js & Kotlin

> As a developer using Node.js/Kotlin MCP, I want a Viewer UI (web dashboard) so that I can visualize knowledge base state

**Requirement Details:**

1. Port Python's existing Viewer UI (HTML/JS static files) to Node.js and Kotlin
2. Serve static files from MCP server on configurable port (default: disabled)
3. Dashboard shows: KB entries, memory stats, cache stats, tool registry
4. Real-time updates via WebSocket or SSE
5. Can share Python's static HTML/JS files (same frontend, different backend)

**Acceptance Criteria:**

1. Given Viewer UI enabled in config, when user opens browser to configured port, then dashboard loads
2. Given KB has entries, when dashboard loads, then entries are displayed with metadata
3. Given new entry ingested, when dashboard is open, then it updates in real-time
4. Given Viewer UI disabled (default), then no port is opened and no resources consumed

---

#### STORY 7: Nested Detection — Port to Kotlin

> As a developer using Kotlin MCP, I want Nested Detection so that child MCP servers exposing find_tools are automatically discovered

**Requirement Details:**

1. Implement nested server detection in Kotlin MCP (reference: Node.js implementation)
2. Detect child MCP servers that expose `find_tools` capability
3. Register discovered tools in parent's tool registry with server attribution
4. Handle child server lifecycle (connect, disconnect, reconnect)
5. Propagate tool calls to appropriate child server

**Acceptance Criteria:**

1. Given child MCP server running with find_tools, when Kotlin parent starts, then child's tools are discovered and registered
2. Given child server disconnects, when tool call is attempted, then graceful error with retry
3. Given child server reconnects with new tools, then registry is updated (new tools added, removed tools cleaned)
4. Given multiple child servers, when find_tools is called, then results include tools from all children with server attribution

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| KSA-139 | System | KSA-139 | Cache layer related work — Node.js cache implementation |
| Node.js Core Memory | System | N/A | Reference implementation for F1 (must be stable) |
| Node.js Conversation | System | N/A | Reference implementation for F2 (must be stable) |
| Node.js Structured Map | System | N/A | Reference implementation for F3 (must be stable) |
| Python Cache Layer | System | N/A | Reference implementation for Node.js cache port |
| Python Viewer UI | System | N/A | Reference implementation for Viewer UI port |
| chokidar (npm) | External | N/A | File watching library for Node.js |
| SQLite | External | N/A | Database for Python/Kotlin schema migrations |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Reporter | Duc Nguyen Minh | Product Owner, requirements definition | Jira reporter |
| Developer | Development Team | Implementation across 3 MCP modules | Jira assignee |
| Architect | SA Agent | Technical design and cross-module consistency | Review |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Schema migration breaks existing data in Python/Kotlin | High | Medium | Implement reversible migrations with backup step |
| Ported features behave differently from reference | Medium | Medium | Comprehensive integration tests comparing outputs |
| File watcher causes high CPU on large workspaces | Medium | Medium | Configurable watch patterns, debouncing, max file limit |
| Viewer UI port introduces security vulnerabilities | High | Low | Bind to localhost only by default, no auth needed for local |
| Cross-platform path handling differences | Medium | Medium | Use platform-agnostic path libraries in each language |
| Large scope causes delayed delivery | Medium | High | Prioritize F1/F2/F3 and Cache (HIGH), defer Viewer UI (LOW) |

### 5.2 Assumptions

- Node.js Core Memory, Conversation History, and Structured Map implementations are stable and well-tested
- Python Cache layer and Viewer UI are stable references
- All 3 implementations use SQLite as the backing store (consistent schema approach)
- The MCP tool interface (input/output schema) is identical across implementations
- Developers are familiar with all 3 codebases (Python, TypeScript, Kotlin)
- No breaking changes to MCP protocol during implementation

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Core Memory auto-recall | < 5ms to load pinned entries on session start |
| Performance | Conversation search | < 50ms for full-text search across sessions |
| Performance | Cache hit latency | < 1ms for cache lookups |
| Performance | File watcher debounce | 500ms batch window, re-index within 2s of last change |
| Storage | Conversation history | Max 100 sessions, 1000 turns per session before archival |
| Storage | Cache size | Configurable, default 1000 entries per cache type |
| Reliability | Schema migration | Must be reversible, must not lose existing data |
| Reliability | File watcher | Graceful degradation on permission errors |
| Compatibility | Cross-platform | Windows, macOS, Linux for all 3 implementations |
| Compatibility | Feature parity | Identical MCP tool schemas across all implementations |
| Security | Viewer UI | Localhost-only binding by default |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-142 | Feature Parity Sync — Đồng bộ 3 MCP implementations | In Progress | Task | Main ticket |
| KSA-139 | Cache layer related | — | Task | Related (Node.js cache) |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Feature Parity | State where all implementations offer identical functionality |
| Core Memory | Pinned knowledge entries that are auto-recalled at session start |
| Structured Map | Extracted metadata (entities, topics, decisions) from knowledge entries |
| Nested Detection | Automatic discovery of child MCP servers and their tools |
| File Watcher | Background process monitoring filesystem for changes |
| LRU Cache | Least Recently Used cache eviction strategy |
| Schema Migration | Database schema change applied incrementally and reversibly |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| Node.js Core Memory | `mcp-code-intelligence-nodejs/src/memory/core-memory.ts` |
| Node.js Conversation | `mcp-code-intelligence-nodejs/src/memory/conversation.ts` |
| Node.js Structured Map | `mcp-code-intelligence-nodejs/src/memory/structured-map.ts` |
| Python Cache Layer | `mcp-code-intelligence-python/src/mcp_code_intel/orchestration/cache/` |
| Python Viewer UI | `mcp-code-intelligence-python/src/mcp_code_intel/viewer/` |
| Kotlin Nested Detection | N/A (to be implemented) |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
