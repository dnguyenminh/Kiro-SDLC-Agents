# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-63: Fix Tool Discovery, Semantic Grouping & Fallback Chain Execution

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-63 |
| Title | Fix Tool Discovery, Semantic Grouping & Fallback Chain Execution |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-14 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-63 and code review findings |

---

## 1. Introduction

### 1.1 Scope

This ticket addresses critical defects in the MCP Code Intelligence Kotlin orchestration layer that prevent proper tool discovery, semantic grouping, and fallback execution across upstream MCP servers. The current implementation has four confirmed root causes:

1. **find_tools search** uses naive `contains()` substring matching — no tokenization or semantic similarity
2. **Tool grouping** only groups by exact tool name (`groupBy { it.name }`) — does not group tools with similar descriptions/functionality from different servers
3. **No nested orchestrator support** — only direct child servers are discovered; nested orchestrators' tools are invisible
4. **KB ingest disconnected from search** — `ingestToolsToKb()` writes to memory but `search()` queries the in-memory registry — two separate systems that don't interoperate

### 1.2 Out of Scope

- UI changes to the MCP client or IDE extension
- Changes to the MCP protocol specification itself
- Adding new MCP servers or tool implementations
- Performance optimization of existing tool execution (latency tuning)
- Changes to the memory/KB storage engine internals

### 1.3 Preliminary Requirements

- Existing orchestration engine is functional (can start child servers, route calls)
- At least 2 MCP child servers configured for testing fallback chains
- KB (memory engine) is operational for tool ingestion
- Understanding of MCP protocol tool discovery (`tools/list`)

---

## 2. Business Requirements

### 2.1 High Level Process Map

The orchestration layer manages a hierarchy of MCP servers. On startup, it discovers tools from all child servers, indexes them for searchability, groups functionally-equivalent tools into fallback chains, and routes execution requests with automatic failover.

**Current broken flow:**
1. Startup → discover tools from direct children only (misses nested)
2. Ingest tool definitions into KB (but search doesn't use KB)
3. Agent calls `find_tools("search issues")` → substring match fails for tools named `jira_search` with description "Search issues with JQL"
4. Agent calls tool → if first server fails, fallback only works for exact-name duplicates

**Target flow:**
1. Startup → recursively discover tools from all levels (children + nested orchestrators)
2. Ingest tool definitions into KB with semantic embeddings
3. Agent calls `find_tools("search issues")` → semantic/tokenized search finds `jira_search` by matching description tokens
4. System groups tools with similar functionality into fallback chains (even if names differ)
5. Agent calls tool → if first server fails, automatically tries next server in chain (priority order from config)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As an AI agent, I want to find tools by describing what I need (semantic search) so that I don't need to know exact tool names | MUST HAVE | KSA-63 |
| 2 | As an AI agent, I want tools with similar functionality grouped into fallback chains so that if one server fails, execution automatically retries on another | MUST HAVE | KSA-63 |
| 3 | As an orchestrator, I want to recursively discover tools from nested orchestrators so that the full tool hierarchy is available | MUST HAVE | KSA-63 |
| 4 | As an orchestrator, I want fallback chain priority determined by server declaration order in config so that closer/faster servers are tried first | MUST HAVE | KSA-63 |
| 5 | As an AI agent, I want find_tools to search both the in-memory registry AND the KB so that all indexed tools are discoverable | SHOULD HAVE | KSA-63 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Startup & Discovery Flow:**

**Step 1:** OrchestrationEngine starts, reads config for declared MCP servers (ordered list)

**Step 2:** For each server, call `tools/list` to get tool definitions

**Step 3:** For each tool returned, check if the server itself is a nested orchestrator (has `find_tools` / `execute_dynamic_tool` meta-tools)

**Step 4:** If nested orchestrator detected → recursively call its `find_tools` with wildcard/empty query to get its child tools, tagging them with depth level

**Step 5:** All discovered tools are registered in UnifiedRegistry with source server name and priority (config declaration order)

**Step 6:** Build fallback chains: group tools by semantic similarity of description (not just exact name match)

**Step 7:** Ingest all tool definitions into KB with proper tokenization for later semantic search

**Execution & Fallback Flow:**

**Step 1:** Agent calls `execute_dynamic_tool(tool_name, args)`

**Step 2:** System looks up tool in registry → finds fallback chain if exists

**Step 3:** Execute on highest-priority server (lowest index in config order)

**Step 4:** If execution fails (error/timeout) → automatically try next server in chain

**Step 5:** If all servers in chain fail → return aggregated error

> **Note:** Priority order is: Kiro-level tools (outermost) = priority 0, then child servers in config declaration order = priority 1, 2, 3...

---

#### STORY 1: Semantic Tool Search (find_tools)

> As an AI agent, I want to find tools by describing what I need (semantic search) so that I don't need to know exact tool names.

**Requirement Details:**

1. `find_tools` must tokenize the query into individual words/terms
2. Each term is matched against tool name tokens AND description tokens (case-insensitive)
3. Scoring: tools matching more terms rank higher; name matches score higher than description matches
4. Support multi-word queries: "search issues with query" should match a tool with description containing "search", "issues", "query"
5. Results are sorted by relevance score (descending), limited to top-K results (default 10)
6. Must search BOTH the in-memory registry AND KB entries tagged as tool definitions

**Acceptance Criteria:**

1. Given a tool named `jira_search` with description "Search issues using JQL query language", when agent calls `find_tools("search issues")`, then the tool appears in results
2. Given a tool named `add_comment` with description "Add a comment to a Jira issue", when agent calls `find_tools("comment on ticket")`, then the tool appears in results (matching "comment")
3. Given 50 registered tools, when agent calls `find_tools("deploy")`, then only tools with "deploy" in name or description are returned (not all 50)
4. Given two tools matching a query, one matching in name and one in description only, then the name-match tool ranks higher
5. Given an empty query, then return all tools (or top-K by default)

**Validation Rules:**

- Query must be non-empty string (or return all tools)
- Results capped at configurable top-K (default 10)
- Each result includes: tool name, description, source server, relevance score

---

#### STORY 2: Semantic Fallback Chain Grouping

> As an AI agent, I want tools with similar functionality grouped into fallback chains so that if one server fails, execution automatically retries on another.

**Requirement Details:**

1. On startup (after all tools discovered), system analyzes tool descriptions for semantic similarity
2. Tools are grouped into fallback chains when they have:
   - Same exact name on different servers (current behavior — keep this), OR
   - High description similarity score (>0.7 threshold) indicating same functionality
3. Each chain is ordered by server priority (config declaration order: index 0 = highest priority)
4. Chain metadata stored in UnifiedRegistry for O(1) lookup during execution
5. Chains are rebuilt when config is hot-reloaded or servers reconnect

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| toolName | String | Yes | Canonical name for the chain | `jira_search` |
| entries | List<ChainEntry> | Yes | Ordered list of server+priority | `[{jira-server, 0}, {backup-jira, 1}]` |
| groupingReason | String | Yes | Why tools were grouped | `exact_name` or `semantic_similarity:0.85` |
| similarNames | List<String> | No | Alternative tool names in chain | `[search_issues, jira_query]` |

**Acceptance Criteria:**

1. Given server-A has `search_issues` (desc: "Search Jira issues with JQL") and server-B has `jira_search` (desc: "Query Jira issues using JQL"), when startup completes, then both are in the same fallback chain
2. Given server-A has `get_weather` and server-B has `fetch_temperature`, when descriptions are dissimilar, then they are NOT grouped
3. Given 3 servers all providing `code_search` (exact same name), when startup completes, then chain has 3 entries ordered by config position
4. Given config order is [server-A, server-B, server-C], when chain is built, then server-A has priority 0, server-B has priority 1, server-C has priority 2
5. Given config is hot-reloaded with new server order, when rebuild triggers, then chain priorities update accordingly

**Error Handling:**

- If similarity computation fails for a tool pair → skip grouping, log warning
- If a server goes offline → its entries remain in chain but are skipped during execution (fail fast)

---

#### STORY 3: Recursive Nested Orchestrator Discovery

> As an orchestrator, I want to recursively discover tools from nested orchestrators so that the full tool hierarchy is available.

**Requirement Details:**

1. After initial `tools/list` from a child server, check if response includes meta-tools (`find_tools`, `execute_dynamic_tool`)
2. If meta-tools detected → server is a nested orchestrator
3. Call nested orchestrator's `find_tools` with empty/wildcard query to enumerate all its tools
4. Tag discovered tools with depth level: depth 0 = direct child, depth 1 = grandchild, etc.
5. Priority calculation: `base_priority = config_index * 100 + depth` (deeper = lower priority)
6. Respect `maxRecursionDepth` config to prevent infinite loops
7. Nested tools are registered in UnifiedRegistry with source = `"child:{serverName}:depth{N}"`

**Acceptance Criteria:**

1. Given server-A is a nested orchestrator with 5 child tools, when startup completes, then all 5 tools are discoverable via `find_tools`
2. Given maxRecursionDepth = 2, when a depth-3 nested orchestrator exists, then its tools are NOT discovered
3. Given server-A (depth 0) and server-A's child server-B (depth 1) both have `code_search`, when chain is built, then server-A's version has higher priority
4. Given a nested orchestrator goes offline during discovery, when timeout occurs, then discovery continues with other servers (graceful degradation)
5. Given circular orchestrator references (A→B→A), when discovery runs, then maxRecursionDepth prevents infinite loop

**Validation Rules:**

- maxRecursionDepth must be ≥ 1 and ≤ 5 (configurable, default 3)
- Discovery timeout per server: configurable (default 10s)
- If nested discovery fails, direct tools from that server are still registered

---

#### STORY 4: Config-Based Priority Order for Fallback Chains

> As an orchestrator, I want fallback chain priority determined by server declaration order in config so that closer/faster servers are tried first.

**Requirement Details:**

1. Server priority = index position in `orchestration.json` `mcpServers` object (first declared = priority 0)
2. Kiro-level (outermost orchestrator) native tools always have priority -1 (highest)
3. Within a fallback chain, execution order follows priority ascending (0 first, then 1, then 2...)
4. If two servers have same priority (shouldn't happen with index-based), use alphabetical server name as tiebreaker
5. Priority is recalculated on config hot-reload

**Acceptance Criteria:**

1. Given config declares servers in order [jira-primary, jira-backup, jira-archive], when `jira_search` chain executes, then jira-primary is tried first
2. Given jira-primary fails with timeout, when fallback triggers, then jira-backup is tried next (not jira-archive)
3. Given all servers in chain fail, when execution completes, then error message lists all attempted servers and their individual errors
4. Given config is reloaded with reversed order [jira-archive, jira-backup, jira-primary], when next execution occurs, then jira-archive is tried first
5. Given a native tool `code_search` exists AND child server also has `code_search`, when executed, then native version is used (priority -1 wins)

---

#### STORY 5: Unified Search Across Registry and KB

> As an AI agent, I want find_tools to search both the in-memory registry AND the KB so that all indexed tools are discoverable.

**Requirement Details:**

1. `find_tools` first searches UnifiedRegistry (fast, in-memory)
2. Then searches KB (memory engine) for entries tagged with "tools,registry"
3. Results are merged, deduplicated by tool name, and sorted by relevance
4. KB search uses the memory engine's existing hybrid search (BM25 + vector)
5. If KB is unavailable, gracefully fall back to registry-only search

**Acceptance Criteria:**

1. Given a tool registered in registry only, when `find_tools` is called, then tool is found
2. Given a tool ingested in KB only (e.g., from a previous session), when `find_tools` is called, then tool is found
3. Given same tool exists in both registry and KB, when results are merged, then only one entry appears (no duplicates)
4. Given KB engine is down/unavailable, when `find_tools` is called, then registry results are still returned (no error)
5. Given 100 tools in registry and 50 in KB (with 30 overlap), when `find_tools("")` is called, then 120 unique tools are returned

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Memory Engine (KB) | System | N/A | Required for semantic search and tool ingestion |
| LocalServerManager | System | N/A | Manages child MCP server processes |
| MCP Protocol (tools/list) | External | N/A | Standard protocol for tool discovery |
| orchestration.json config | System | N/A | Declares server order and settings |
| kotlinx.serialization | System | N/A | JSON parsing for tool definitions |
| Coroutines (kotlinx.coroutines) | System | N/A | Async execution for nested discovery |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Developer / Architect | Duc Nguyen | Implementation, architecture decisions | Jira reporter |
| AI Agents (consumers) | SM, BA, SA, DEV, QA agents | Use find_tools and execute_dynamic_tool | End users |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Semantic similarity produces false positives (unrelated tools grouped) | High | Medium | Use conservative threshold (0.7+), allow manual override in config |
| Recursive discovery causes startup delay | Medium | Medium | Parallel discovery with timeout per server; cache results |
| Circular orchestrator references | High | Low | maxRecursionDepth cap + visited-set tracking |
| KB search latency degrades find_tools response time | Medium | Low | Timeout KB search at 2s, fall back to registry-only |
| Hot-reload during active execution causes inconsistent state | High | Low | Use read-write lock on registry during rebuild |

### 5.2 Assumptions

- All child MCP servers implement standard `tools/list` method
- Nested orchestrators expose `find_tools` meta-tool for recursive discovery
- Tool descriptions are meaningful English text (not empty or gibberish)
- Config file `orchestration.json` is valid JSON and server order is intentional
- Memory engine supports text search with reasonable performance (<500ms for 1000 entries)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | find_tools response < 200ms | For up to 500 registered tools, search should complete within 200ms |
| Performance | Startup discovery < 15s | Full recursive discovery of all servers should complete within 15s |
| Performance | Fallback execution overhead < 100ms | Per-hop overhead (excluding actual tool execution) should be < 100ms |
| Reliability | Graceful degradation | If any single server is down, remaining tools still function |
| Reliability | Chain execution resilience | Failed server in chain does not block subsequent servers |
| Scalability | Support up to 500 tools | Registry and search must handle 500+ tool definitions |
| Scalability | Support up to 10 child servers | Including nested orchestrators at depth ≤ 3 |
| Maintainability | Config-driven behavior | All thresholds, timeouts, and priorities configurable without code change |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-63 | Fix Tool Discovery, Semantic Grouping & Fallback Chain Execution | To Do | Story | Main ticket |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Fallback Chain | Ordered list of servers that can execute the same tool; tried in priority order |
| Semantic Grouping | Grouping tools by description similarity rather than exact name match |
| Nested Orchestrator | A child MCP server that is itself an orchestrator with its own child servers |
| Priority | Numeric value determining execution order; lower = tried first |
| UnifiedRegistry | In-memory index of all discovered tools from all sources |
| KB (Knowledge Base) | Persistent memory store for searchable tool definitions |
| Config Declaration Order | Position of server in orchestration.json mcpServers object |

### Root Cause Analysis (from code review)

| # | File | Current Behavior | Expected Behavior |
|---|------|-----------------|-------------------|
| 1 | `FindToolsTool.kt` | `search()` uses `contains(q)` substring match | Tokenized multi-term matching with scoring |
| 2 | `UnifiedRegistry.kt` | `rebuildChains()` groups by `groupBy { it.name }` (exact name only) | Group by semantic similarity of descriptions |
| 3 | `OrchestrationEngine.kt` | `buildRoutingTable()` only calls `serverManager.getAllTools()` (direct children) | Recursively discover nested orchestrator tools |
| 4 | `OrchestrationEngine.kt` | `ingestToolsToKb()` writes to memory, `search()` reads from registry | Unified search across both registry AND KB |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
