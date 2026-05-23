# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-139: 2-Level Agent Tool Cache Registry

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-139 |
| Title | 2-Level Agent Tool Cache Registry — KB-based tool discovery cache |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-05-23 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-139.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-23 | BA Agent | Initiate document — functional specs from BRD |
| 1.0 | 2026-05-23 | TA Agent | Technical enrichment — API contracts, pseudocode |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the 2-Level Agent Tool Cache Registry,
a middleware layer that caches successful tool discovery results into the Knowledge Base (KB)
to eliminate redundant `find_tools` calls and reduce token consumption.

### 1.2 Scope

The system intercepts tool discovery and execution flows within the Python MCP orchestration
layer, adding a KB-backed cache with two levels (global and per-agent) that persists across sessions.

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| L1 Cache | Global scope — tools accessible by all agents |
| L2 Cache | Agent scope — tools specific to one agent |
| Hit Count | Number of successful executions of a cached tool |
| Injection | Pre-loading cached tools into sub-agent prompt |
| Lookup Cascade | Sequential search: L2 → L1 → find_tools |
| KB | Knowledge Base (SQLite-backed vector store) |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-139.docx |
| Orchestration Architecture | .kiro/steering/orchestration.md |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

The Tool Cache Registry sits between AI Agents and the Orchestration Engine's `find_tools`/`execute_dynamic_tool` meta-tools. It intercepts tool requests, checks KB cache, and only delegates to the expensive discovery path on cache miss.

**External Actors:**
- AI Agents (SM, BA, SA, QA, DEV, DevOps) — consumers of cached tools
- Parent Agent (SM) — triggers startup injection for sub-agents
- User — configures injection parameters

**External Systems:**
- KB Server (SQLite) — persistent storage for cache entries
- MCP Child Servers (Atlassian, Bridge, etc.) — source of tool definitions
- UnifiedRegistry — in-memory tool registry (existing)

### 2.2 System Architecture

The cache operates as a transparent layer within the existing orchestration:

1. **Cache Interceptor** — hooks into `find_tools` and `execute_dynamic_tool`
2. **KB Cache Store** — manages CRUD operations on KB entries with scope tags
3. **Injection Engine** — queries top-N tools and formats for prompt injection
4. **Hit Tracker** — increments usage counters on successful execution

---

## 3. Functional Requirements

### 3.1 Feature: Tool Lookup with Cache (Lookup Cascade)

**Source:** BRD Story 1, Story 8

#### 3.1.1 Description

When an agent needs a tool, the system performs a cascading lookup: first checking the agent-specific cache (L2), then the global cache (L1), and finally falling back to `find_tools` discovery. The first hit short-circuits remaining lookups.

#### 3.1.2 Use Case

**Use Case ID:** UC-01
**Actor:** AI Agent
**Preconditions:** MCP server is running, KB server is available
**Postconditions:** Agent has tool metadata sufficient for `execute_dynamic_tool`

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent requests tool by description | | Agent calls internal lookup with query string |
| 2 | | Search L2 cache (agent scope) | KB search with tags: `tool-cache, agent:{agent_name}` |
| 3 | | Return cached tool if found | Return tool_name, server_name, input_schema |
| 4 | | If L2 miss, search L1 cache | KB search with tags: `tool-cache, scope:global` |
| 5 | | Return cached tool if found | Return tool_name, server_name, input_schema |
| 6 | | If L1 miss, call find_tools | Delegate to existing discovery mechanism |
| 7 | | Return discovered tool | Return full tool definition from MCP server |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | KB server unavailable | Skip cache lookup, go directly to find_tools (graceful degradation) |
| AF-02 | Multiple tools match query | Return highest-hit tool from cache; if from find_tools, return top match |
| AF-03 | Agent has no L2 entries | Skip L2, proceed to L1 lookup |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Cached tool no longer exists on server | execute_dynamic_tool fails → trigger invalidation (UC-03) |
| EF-02 | KB search timeout (>100ms) | Log warning, fall back to find_tools |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-01 | L2 (agent scope) is always searched before L1 (global scope) | BRD Story 1 |
| BR-02 | First cache hit short-circuits remaining lookups | BRD Story 1 |
| BR-03 | Cache hit must provide complete tool metadata for direct execution | BRD Story 1 |
| BR-04 | KB search must complete within 100ms or be abandoned | BRD NFR |
| BR-05 | If KB unavailable, system degrades gracefully to find_tools | BRD NFR |

#### 3.1.4 Data Specifications

**Cache Entry Schema (KB Entry):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| title | String | Y | Format: `tool-cache:{scope}:{tool_name}` | Unique identifier for dedup |
| tool_name | String | Y | Non-empty, matches `[a-z_]+` | Tool identifier for execution |
| server_name | String | Y | Non-empty | MCP server hosting the tool |
| description | String | Y | Max 500 chars | Tool description for semantic search |
| input_schema | JSON String | Y | Valid JSON Schema | Parameters schema for execution |
| scope | String | Y | `global` or `agent:{name}` | Cache level identifier |
| hits | Integer | Y | >= 0 | Usage counter |
| last_used | ISO DateTime | Y | Valid ISO 8601 | Last successful usage |

**KB Tags Structure:**

| Scope | Tags |
|-------|------|
| Global (L1) | `tool-cache, scope:global, server:{server_name}` |
| Agent (L2) | `tool-cache, agent:{agent_name}, server:{server_name}` |

#### 3.1.5 API Contract (Functional View)

**Internal Function:** `cache_lookup(query: str, agent_name: str) -> Optional[ToolEntry]`
**Purpose:** Find a cached tool matching the query, checking agent scope then global scope.

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| query | String | Y | BR-04 (100ms timeout) | Natural language description of needed tool |
| agent_name | String | Y | BR-01 (L2 first) | Calling agent identifier |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| tool_name | String | Tool identifier for execute_dynamic_tool |
| server_name | String | Server hosting the tool |
| input_schema | JSON | Full parameter schema |
| source | Enum | `l2_cache`, `l1_cache`, or `discovered` |

**Business Error Scenarios:**

| Scenario | Behavior | Trigger Condition |
|----------|----------|-------------------|
| KB unavailable | Fall back to find_tools | KB server not responding |
| No match found | Return None, caller uses find_tools | No cache entry matches query |
| Timeout | Abandon KB search, use find_tools | KB search exceeds 100ms |

---

### 3.2 Feature: Automatic Cache Population

**Source:** BRD Story 2

#### 3.2.1 Description

After a successful tool execution, the system automatically ingests tool metadata into KB. The ingestion rules depend on how the tool was found (newly discovered vs. from cache).

#### 3.2.2 Use Case

**Use Case ID:** UC-02
**Actor:** System (triggered by successful execute_dynamic_tool)
**Preconditions:** Tool execution completed successfully
**Postconditions:** Tool entry exists in KB with updated hit count

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Detect successful execution | execute_dynamic_tool returns non-error result |
| 2 | | Determine tool source | Was it from L2, L1, or newly discovered? |
| 3 | | If newly discovered: ingest to L1 + L2 | Create entries in both global and agent scope |
| 4 | | If from L1: ingest to L2 only | Create agent-scope entry, increment L1 hits |
| 5 | | If from L2: increment hits only | Update existing L2 entry hit count |
| 6 | | Update last_used timestamp | Set to current time |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | KB ingest fails | Log error, do not block execution response |
| AF-02 | Entry already exists (dedup) | Update hit count instead of creating new |

#### 3.2.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-06 | Newly discovered tools are ingested into BOTH L1 and L2 | BRD Story 2 |
| BR-07 | Tools from L1 are ingested into L2 only (no L1 duplicate) | BRD Story 2 |
| BR-08 | Tools from L2 only get hit count increment | BRD Story 2 |
| BR-09 | Ingestion is asynchronous (non-blocking) | BRD NFR |
| BR-10 | Dedup by tool_name + scope (title format prevents duplicates) | BRD Story 5 |

#### 3.2.4 Pseudocode

```python
async def on_tool_execution_success(tool_name, server_name, input_schema, description, agent_name, source):
    """Called after successful execute_dynamic_tool."""
    title_l2 = f"tool-cache:agent:{agent_name}:{tool_name}"
    title_l1 = f"tool-cache:global:{tool_name}"
    
    if source == "discovered":  # From find_tools
        # Ingest into both L1 and L2
        await kb_ingest(title=title_l1, content=format_entry(tool_name, server_name, input_schema, description),
                       tags="tool-cache, scope:global, server:{server_name}", issue_key="TOOL-CACHE")
        await kb_ingest(title=title_l2, content=format_entry(tool_name, server_name, input_schema, description),
                       tags=f"tool-cache, agent:{agent_name}, server:{server_name}", issue_key="TOOL-CACHE")
    elif source == "l1_cache":  # From global cache
        # Ingest into L2 only, increment L1 hits
        await kb_ingest(title=title_l2, content=format_entry(...), tags=f"tool-cache, agent:{agent_name}, ...")
        await increment_hits(title_l1)
    elif source == "l2_cache":  # From agent cache
        # Just increment hits
        await increment_hits(title_l2)
```

---

### 3.3 Feature: Cache Invalidation on Failure

**Source:** BRD Story 3

#### 3.3.1 Description

When a tool execution fails with a tool-level error (not transient), the system deletes the cached entry to force re-discovery on next lookup.

#### 3.3.2 Use Case

**Use Case ID:** UC-03
**Actor:** System (triggered by failed execute_dynamic_tool)
**Preconditions:** Tool execution failed with non-transient error
**Postconditions:** Cache entry removed, next lookup will re-discover

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Detect execution failure | execute_dynamic_tool returns error |
| 2 | | Classify error type | Is it transient (timeout) or permanent (not found)? |
| 3 | | If permanent: delete L2 entry | Remove agent-scope cache entry |
| 4 | | If permanent: delete L1 entry | Remove global-scope cache entry |
| 5 | | Log invalidation event | Record for debugging |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Transient error (timeout, network) | Do NOT invalidate, keep cache entry |
| AF-02 | Server disconnected | Invalidate ALL entries for that server |
| AF-03 | Entry doesn't exist in cache | No-op (tool was already uncached) |

#### 3.3.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-11 | Only permanent errors trigger invalidation | BRD Story 3 |
| BR-12 | Transient errors (timeout, network) do NOT invalidate | BRD Story 3 |
| BR-13 | Server disconnect invalidates all entries for that server | BRD Story 3 |
| BR-14 | Invalidation is best-effort (failure to delete is logged, not fatal) | BRD NFR |

#### 3.3.4 Error Classification

| Error Type | Classification | Action |
|------------|---------------|--------|
| Tool not found | Permanent | Invalidate |
| Schema mismatch | Permanent | Invalidate |
| Permission denied | Permanent | Invalidate |
| Network timeout | Transient | Keep cache |
| Connection refused | Transient | Keep cache (server may restart) |
| Server disconnected | Server-level | Invalidate all for server |
| Rate limited | Transient | Keep cache |

---

### 3.4 Feature: Startup Injection

**Source:** BRD Story 4, Story 5

#### 3.4.1 Description

When a parent agent invokes a sub-agent, the system queries KB for the top-N most-used tools for that agent and injects them into the sub-agent's prompt. This allows sub-agents to call `execute_dynamic_tool` directly without any `find_tools` calls.

#### 3.4.2 Use Case

**Use Case ID:** UC-04
**Actor:** Parent Agent (SM)
**Preconditions:** Sub-agent is being invoked, KB has cached tools for that agent
**Postconditions:** Sub-agent prompt contains top-N tool definitions

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Parent invokes sub-agent | | SM calls invokeSubAgent(name, prompt) |
| 2 | | Query L2 cache for agent | KB search: tags=`tool-cache, agent:{name}`, top_k=N |
| 3 | | Rank by hit count DESC | Sort results by hits field |
| 4 | | If L2 has < N tools, supplement from L1 | Fill remaining slots from global cache |
| 5 | | Format injection payload | Compact JSON with tool_name, server_name, input_schema |
| 6 | | Prepend to sub-agent prompt | Add tool definitions before user prompt |
| 7 | Agent receives enriched prompt | | Sub-agent can now call execute_dynamic_tool directly |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | No cached tools for agent | Skip injection, agent uses find_tools normally |
| AF-02 | KB unavailable | Skip injection, agent uses find_tools normally |
| AF-03 | Agent has exactly N tools | Use all L2 tools, no L1 supplement needed |

#### 3.4.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-15 | Default N = 5 tools injected | BRD Story 4 |
| BR-16 | Tools ranked by hits DESC | BRD Story 5 |
| BR-17 | L2 tools have priority over L1 supplements | BRD Story 4 |
| BR-18 | Injection format must be compact (minimize tokens) | BRD NFR |
| BR-19 | Injected tools must be sufficient for direct execution | BRD Story 4 |

#### 3.4.4 Injection Format

```json
{
  "cached_tools": [
    {
      "tool_name": "jira_get_issue",
      "server_name": "atlassian",
      "input_schema": {"type":"object","required":["issue_key"],"properties":{"issue_key":{"type":"string"}}}
    },
    {
      "tool_name": "kb_search",
      "server_name": "kb-server",
      "input_schema": {"type":"object","required":["query"],"properties":{"query":{"type":"string","maxLength":2000}}}
    }
  ]
}
```

**Token Estimate:** ~200-400 tokens for 5 tools (vs. ~2500 tokens for 5 find_tools calls + responses)

---

### 3.5 Feature: Configuration Management

**Source:** BRD Story 6

#### 3.5.1 Description

Users can configure the number of tools injected at startup (N) via settings. Configuration persists and takes effect on next sub-agent invocation.

#### 3.5.2 Use Case

**Use Case ID:** UC-05
**Actor:** User (Developer)
**Preconditions:** MCP server is running
**Postconditions:** Configuration updated, effective on next invocation

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | User updates setting | | Set `tool_cache.inject_count` via config file or tool |
| 2 | | Validate value | Must be integer 0-20 |
| 3 | | Persist configuration | Save to config file |
| 4 | | Apply on next invocation | Next sub-agent call uses new N |

#### 3.5.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-20 | Default inject_count = 5 | BRD Story 6 |
| BR-21 | Valid range: 0-20 (0 disables injection) | Design decision |
| BR-22 | Changes are hot-reloadable (no restart needed) | BRD Story 6 |
| BR-23 | Configuration stored in orchestration.json | Design decision |

---

## 4. Data Model

### 4.1 Logical Entities

#### Entity: ToolCacheEntry

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| title | String | Y | BR-10 (dedup key) | Format: `tool-cache:{scope}:{tool_name}` |
| tool_name | String | Y | | Unique tool identifier |
| server_name | String | Y | | MCP server name |
| description | String | Y | | Tool description for search |
| input_schema | JSON | Y | BR-19 | Full JSON Schema |
| scope | String | Y | BR-01 | `global` or `agent:{name}` |
| hits | Integer | Y | BR-16 | Usage counter |
| last_used | DateTime | Y | | Last successful execution |
| tags | String | Y | | KB tags for filtering |

**Relationships:**

| From Entity | To Entity | Cardinality | Description |
|-------------|-----------|-------------|-------------|
| ToolCacheEntry (L1) | ToolCacheEntry (L2) | 1:N | One global entry can have multiple agent-specific entries |
| ToolCacheEntry | MCP Server | N:1 | Multiple tools belong to one server |

### 4.2 State Diagram

![State Diagram](diagrams/state-cache-entry.png)

**States:**
- **Not Cached** — Tool has never been used or was invalidated
- **Cached (Active)** — Tool is in KB, available for lookup
- **Stale** — Tool execution failed, entry pending deletion

**Transitions:**
- Not Cached → Cached: Successful execution of newly discovered tool
- Cached → Cached: Successful re-execution (hit count increment)
- Cached → Not Cached: Permanent execution failure (invalidation)
- Cached → Not Cached: Server disconnected (bulk invalidation)

---

## 5. Integration Specifications

### 5.1 External System: KB Server (SQLite)

| Attribute | Value |
|-----------|-------|
| Purpose | Persistent storage for tool cache entries |
| Direction | Bidirectional |
| Data Format | JSON (via kb_ingest/kb_search tools) |
| Frequency | Real-time (on every tool execution) |

**Data Exchange:**

| Our Data | KB Operation | Direction | Business Rule |
|----------|-------------|-----------|---------------|
| ToolCacheEntry | kb_ingest | Write | BR-06, BR-07, BR-08 |
| Query + tags | kb_search | Read | BR-01, BR-04 |
| Title (for delete) | kb_delete (by title) | Write | BR-11, BR-13 |

### 5.2 External System: UnifiedRegistry (In-Memory)

| Attribute | Value |
|-----------|-------|
| Purpose | Existing in-memory tool registry (fast, volatile) |
| Direction | Read |
| Data Format | Internal Python objects |
| Frequency | On cache miss (fallback to find_tools) |

**Interaction:** Cache miss → find_tools → UnifiedRegistry search → if found, populate KB cache.

### 5.3 External System: MCP Child Servers

| Attribute | Value |
|-----------|-------|
| Purpose | Source of tool definitions (discovery) |
| Direction | Read |
| Data Format | MCP protocol (JSON-RPC) |
| Frequency | On cache miss only (expensive operation) |

---

## 6. Processing Logic

### 6.1 Lookup Cascade Process

**Trigger:** Agent needs a tool (internal function call)
**Input:** query string, agent_name
**Output:** ToolEntry or None

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Search KB with tags `tool-cache, agent:{name}` | If KB error → skip to step 3 |
| 2 | If hit → return tool entry (source=l2_cache) | |
| 3 | Search KB with tags `tool-cache, scope:global` | If KB error → skip to step 5 |
| 4 | If hit → return tool entry (source=l1_cache) | |
| 5 | Call find_tools(query) | If error → return None |
| 6 | If hit → return tool entry (source=discovered) | |
| 7 | Return None (no tool found) | |

### 6.2 Cache Population Process

**Trigger:** Successful execute_dynamic_tool response
**Input:** tool_name, server_name, input_schema, description, agent_name, source
**Output:** KB entries created/updated

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Determine source (discovered/l1/l2) | |
| 2 | Build title keys for dedup | |
| 3 | If discovered: kb_ingest L1 entry | Log error, continue |
| 4 | If discovered or l1: kb_ingest L2 entry | Log error, continue |
| 5 | If l2: increment hits on existing entry | Log error, continue |
| 6 | Update last_used timestamp | |

### 6.3 Invalidation Process

**Trigger:** Failed execute_dynamic_tool with permanent error
**Input:** tool_name, agent_name, error_type
**Output:** KB entries deleted

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Classify error (permanent vs transient) | If transient → abort |
| 2 | Build title keys | |
| 3 | Delete L2 entry: `tool-cache:agent:{name}:{tool}` | Log if not found |
| 4 | Delete L1 entry: `tool-cache:global:{tool}` | Log if not found |
| 5 | Log invalidation event | |

### 6.4 Startup Injection Process

**Trigger:** Parent agent invokes sub-agent
**Input:** agent_name, inject_count (N)
**Output:** Formatted tool list for prompt injection

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Read inject_count from config (default 5) | Use default on error |
| 2 | Query KB: tags=`tool-cache, agent:{name}`, top_k=N | If error → skip injection |
| 3 | Sort results by hits DESC | |
| 4 | If results < N: query L1 for supplement | |
| 5 | Deduplicate (L2 tools take priority) | |
| 6 | Format as compact JSON | |
| 7 | Prepend to sub-agent prompt | |

---

## 7. Security Requirements

### 7.1 Authentication & Authorization

| Role | Permissions | Features |
|------|-------------|----------|
| AI Agent | Read/Write own L2 cache | Lookup, populate own scope |
| System | Read/Write all caches | Populate L1, invalidate any |
| User | Read/Configure | View cache stats, set inject_count |

### 7.2 Data Sensitivity Classification

| Data Type | Classification | Business Requirement |
|-----------|---------------|---------------------|
| Tool names | Internal | Not sensitive, but internal to workspace |
| Input schemas | Internal | API structure, not secret |
| Hit counts | Internal | Usage analytics |
| Server names | Internal | Infrastructure detail |

### 7.3 Audit Trail

| Event | Logged Fields | Retention | Business Reason |
|-------|--------------|-----------|-----------------|
| Cache hit | tool_name, agent, scope, timestamp | Session | Performance monitoring |
| Cache miss | query, agent, timestamp | Session | Optimization opportunity |
| Invalidation | tool_name, error_type, timestamp | 7 days | Debugging |
| Injection | agent, tools_count, timestamp | Session | Token tracking |

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | Cache lookup faster than find_tools | KB search < 100ms (vs. find_tools ~500ms) |
| Performance | Ingestion non-blocking | Tool execution response not delayed by cache write |
| Scalability | Support growing tool ecosystem | Up to 500 entries across all scopes |
| Reliability | Survive restarts | All entries persist in SQLite KB |
| Availability | Graceful degradation | If KB down, fall back to find_tools seamlessly |
| Storage | Compact entries | Each entry < 2KB, total cache < 1MB |

---

## 9. Error Handling (User-Facing)

### 9.1 Error Scenarios

| Scenario | Severity | Behavior | Recovery |
|----------|----------|----------|----------|
| KB unavailable during lookup | Warning | Silent fallback to find_tools | Automatic when KB recovers |
| KB unavailable during ingest | Warning | Log error, skip caching | Next successful call will cache |
| All cached tools stale | Info | Multiple find_tools calls on first use | Cache rebuilds organically |
| Config file corrupted | Warning | Use default inject_count=5 | User fixes config file |

### 9.2 Logging

| Event | Log Level | Message Format |
|-------|-----------|----------------|
| Cache hit (L2) | DEBUG | `[ToolCache] L2 hit: {tool_name} for {agent} (hits={n})` |
| Cache hit (L1) | DEBUG | `[ToolCache] L1 hit: {tool_name} for {agent} (hits={n})` |
| Cache miss | DEBUG | `[ToolCache] Miss: query="{query}" for {agent}` |
| Invalidation | INFO | `[ToolCache] Invalidated: {tool_name} reason={error_type}` |
| Injection | DEBUG | `[ToolCache] Injected {n} tools for {agent}` |
| KB error | WARNING | `[ToolCache] KB error during {operation}: {error}` |

---

## 10. Testing Considerations

### 10.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-01 | L2 cache hit | Query matching cached tool in agent scope | Return tool from L2, skip L1 and find_tools | High |
| TC-02 | L1 cache hit (L2 miss) | Query not in L2 but in L1 | Return tool from L1, skip find_tools | High |
| TC-03 | Full cache miss | Query not in any cache | Call find_tools, return result | High |
| TC-04 | Auto-ingest on success (new tool) | Successful execution of discovered tool | Entry in both L1 and L2 | High |
| TC-05 | Auto-ingest on success (from L1) | Successful execution of L1-cached tool | New L2 entry, L1 hits++ | High |
| TC-06 | Invalidation on permanent error | Tool not found error | L1 and L2 entries deleted | High |
| TC-07 | No invalidation on timeout | Network timeout error | Cache entries preserved | High |
| TC-08 | Startup injection (N tools) | Agent with 10 cached tools, N=5 | Top 5 by hits injected | High |
| TC-09 | Injection supplement from L1 | Agent with 2 cached tools, N=5 | 2 from L2 + 3 from L1 | Medium |
| TC-10 | KB unavailable graceful degradation | KB server down | find_tools works normally | High |
| TC-11 | Hit count persistence | Restart server, query cache | Hit counts preserved | High |
| TC-12 | Dedup on ingest | Same tool ingested twice | Single entry with hits=2 | Medium |
| TC-13 | Server disconnect bulk invalidation | Server disconnects | All entries for server removed | Medium |
| TC-14 | Config change hot-reload | Change inject_count | Next invocation uses new N | Medium |
| TC-15 | Zero injection (N=0) | Set inject_count=0 | No tools injected | Low |

---

## 11. Appendix

### Sequence Diagram: Lookup Cascade

![Sequence Diagram](diagrams/sequence-lookup.png)

### State Diagram: Cache Entry Lifecycle

![State Diagram](diagrams/state-cache-entry.png)

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence: Lookup Cascade | [sequence-lookup.png](diagrams/sequence-lookup.png) | [sequence-lookup.drawio](diagrams/sequence-lookup.drawio) |
| 3 | State: Cache Entry Lifecycle | [state-cache-entry.png](diagrams/state-cache-entry.png) | [state-cache-entry.drawio](diagrams/state-cache-entry.drawio) |

### Change Log from BRD

- Added error classification table (Section 3.3.4) — not in BRD, derived from technical analysis
- Added injection format specification (Section 3.4.4) — compact JSON format for token efficiency
- Added pseudocode for cache population (Section 3.2.4) — implementation guidance
- Added logging specifications (Section 9.2) — operational observability
- Specified KB tags structure (Section 3.1.4) — implementation detail for tag-based filtering
