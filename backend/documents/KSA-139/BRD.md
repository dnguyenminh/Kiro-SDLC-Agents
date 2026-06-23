# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-139: 2-Level Agent Tool Cache Registry

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-139 |
| Title | 2-Level Agent Tool Cache Registry — KB-based tool discovery cache |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-23 |
| Status | Draft |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | Duc Nguyen Minh – Technical Lead | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-23 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-139 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

This change request implements a 2-Level Agent Tool Cache Registry that caches successful tool calls into the Knowledge Base (KB) at two levels (global + per-agent). This enables agents to skip `find_tools` discovery when tools are already known, significantly reducing token consumption (~10,000 tokens/ticket in the SM pipeline).

The system covers:
- KB-based tool registry with global and per-agent scopes
- Automatic cache population on successful tool calls
- Automatic cache invalidation on failed tool calls
- Startup injection of top-N tools into sub-agent prompts
- Hit-based scoring for tool ranking
- Configuration management for injection parameters

### 1.2 Out of Scope

- UI dashboard for viewing/managing cached tools (future enhancement)
- Tool versioning (detecting when a tool's schema changes across server restarts)
- Cross-workspace tool sharing (cache is per-workspace only)
- Tool recommendation engine (suggesting tools an agent hasn't used yet)

### 1.3 Preliminary Requirement

- Knowledge Base (KB) server must be operational with `kb_ingest` and `kb_search` capabilities
- Python MCP Server orchestration layer must be functional
- `find_tools` and `execute_dynamic_tool` meta-tools must be working
- Steering rules infrastructure must support agent-specific configurations

---

## 2. Business Requirements

### 2.1 High Level Process Map

The tool cache registry operates as a transparent middleware layer between agents and the tool discovery system. When an agent needs a tool, the system first checks the KB cache (agent-specific, then global) before falling back to the expensive `find_tools` discovery. Successful tool executions automatically populate the cache, while failures trigger cache invalidation.

![Business Flow](diagrams/business-flow.png)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As an AI agent, I want to lookup tools from KB cache before calling find_tools so that I save ~300-500 tokens per discovery call | MUST HAVE | KSA-139 |
| 2 | As the system, I want to automatically cache successful tool calls so that future lookups are instant | MUST HAVE | KSA-139 |
| 3 | As the system, I want to invalidate cache entries when tool calls fail so that stale entries don't cause repeated failures | MUST HAVE | KSA-139 |
| 4 | As a parent agent (SM), I want to inject top-N cached tools into sub-agent prompts so that sub-agents can skip discovery entirely | MUST HAVE | KSA-139 |
| 5 | As the system, I want to rank cached tools by hit count so that the most frequently used tools are injected first | SHOULD HAVE | KSA-139 |
| 6 | As a user, I want to configure the number of tools injected (N) so that I can balance between token savings and prompt size | SHOULD HAVE | KSA-139 |
| 7 | As the system, I want the cache to persist across IDE restarts and MCP server restarts so that agents benefit from historical usage data | MUST HAVE | KSA-139 |
| 8 | As the system, I want to maintain separate registries per agent scope so that each agent gets tools relevant to its role | MUST HAVE | KSA-139 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Agent determines it needs a specific tool capability (e.g., "search Jira issues")

**Step 2:** System searches KB for matching tool in agent-specific scope (Level 2)

**Step 3:** If miss → System searches KB for matching tool in global scope (Level 1)

**Step 4:** If miss → System calls `find_tools` to discover tool from MCP servers

**Step 5:** Tool is found → System executes tool via `execute_dynamic_tool`

**Step 6:** If execution succeeds → System ingests tool entry into both agent scope and global scope (if newly discovered)

**Step 7:** If execution fails → System deletes existing cache entry from KB → next lookup will re-discover

> **Note:** Steps 2-4 form the "lookup cascade" — each level is checked in order, and the first hit short-circuits the remaining lookups.

---

#### STORY 1: KB Cache Lookup Before Discovery

> As an AI agent, I want to lookup tools from KB cache before calling find_tools so that I save ~300-500 tokens per discovery call

**Requirement Details:**

1. When an agent needs a tool, the system MUST search KB using the agent's scope tag first (e.g., `tool-cache, agent:ba-agent`)
2. If no match in agent scope, search global scope (e.g., `tool-cache, scope:global`)
3. If no match in global scope, fall back to `find_tools` discovery
4. KB search must use semantic matching on tool description/purpose
5. Search results must include full tool metadata (tool_name, server_name, input_schema) sufficient for direct execution

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| tool_name | String | Yes | Unique tool identifier | `jira_search` |
| server_name | String | Yes | MCP server hosting the tool | `atlassian` |
| description | String | Yes | Tool description for semantic search | `Search Jira issues using JQL` |
| input_schema | JSON | Yes | Full JSON Schema for tool parameters | `{"type":"object","required":["jql"],...}` |
| scope | String | Yes | Cache scope identifier | `global` or `agent:ba-agent` |
| hits | Integer | Yes | Usage count for ranking | `15` |
| last_used | ISO DateTime | Yes | Last successful usage timestamp | `2026-05-23T10:00:00Z` |

**Acceptance Criteria:**

1. AC1: Agent lookup KB trước khi gọi find_tools — nếu hit → skip discovery
2. KB search returns results within 100ms
3. Cache hit provides all information needed to call `execute_dynamic_tool` directly
4. Lookup cascade: agent scope → global scope → find_tools (in order)

---

#### STORY 2: Automatic Cache Population on Success

> As the system, I want to automatically cache successful tool calls so that future lookups are instant

**Requirement Details:**

1. After a successful `execute_dynamic_tool` call, the system MUST ingest tool metadata into KB
2. If tool was newly discovered (from `find_tools`), ingest into BOTH global scope AND agent scope
3. If tool was found in global scope, ingest into agent scope only (do NOT duplicate in global)
4. If tool already exists in agent scope, increment hit count only (no new entry)
5. Ingestion must be asynchronous — must not block the tool execution response

**Acceptance Criteria:**

1. AC2: Tool call thành công → auto-ingest vào KB (global + agent scope)
2. Duplicate prevention: same tool_name in same scope → update hit count, not create new entry
3. Ingestion latency does not impact tool execution response time

---

#### STORY 3: Automatic Cache Invalidation on Failure

> As the system, I want to invalidate cache entries when tool calls fail so that stale entries don't cause repeated failures

**Requirement Details:**

1. When `execute_dynamic_tool` returns an error, the system MUST delete the cached entry for that tool
2. Deletion applies to the agent-specific scope entry
3. Global scope entry is also deleted (tool may have been removed from server)
4. Next lookup for the same tool will trigger fresh `find_tools` discovery
5. Transient errors (timeout, network) should NOT invalidate cache — only tool-level errors (tool not found, schema mismatch)

**Acceptance Criteria:**

1. AC3: Tool call thất bại → auto-delete entry cũ từ KB
2. Next lookup after invalidation triggers fresh discovery
3. Transient errors (timeout) do not trigger invalidation

**Error Handling:**

- Tool not found error → invalidate cache entry
- Schema validation error → invalidate cache entry
- Network timeout → do NOT invalidate (retry with same cached entry)
- Server disconnected → invalidate all entries for that server

---

#### STORY 4: Startup Injection of Top-N Tools

> As a parent agent (SM), I want to inject top-N cached tools into sub-agent prompts so that sub-agents can skip discovery entirely

**Requirement Details:**

1. When a parent agent invokes a sub-agent, the system queries KB for top-N tools for that agent scope
2. Tools are ranked by hit count (descending)
3. N is configurable (default = 5)
4. Injected tool data includes: tool_name, server_name, input_schema (sufficient for direct `execute_dynamic_tool` call)
5. Injection format is compact to minimize token consumption
6. If agent has fewer than N cached tools, inject all available + pad with global top tools

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| inject_count | Integer | Yes | Number of tools to inject (N) | `5` |
| agent_name | String | Yes | Target sub-agent identifier | `ba-agent` |
| tools | Array[ToolEntry] | Yes | Ranked list of tools to inject | See schema above |

**Acceptance Criteria:**

1. AC4: Startup injection: top-N tools inject vào sub-agent prompt
2. Injected tools are sufficient for direct execution (no additional discovery needed)
3. Injection adds minimal token overhead (compact format)
4. If agent has < N tools, supplement from global scope

---

#### STORY 5: Hit-Based Scoring and Ranking

> As the system, I want to rank cached tools by hit count so that the most frequently used tools are injected first

**Requirement Details:**

1. Each successful tool execution increments the hit counter by 1
2. Tools are ranked by hits DESC when queried for injection
3. Duplicate prevention: same tool_name in same scope → update existing entry's hit count
4. No decay mechanism needed initially (can be added later if hit counts grow too large)
5. Hit count persists across sessions (stored in KB)

**Acceptance Criteria:**

1. AC5: Hit scoring: tools ranked by usage frequency
2. Most-used tools appear first in injection list
3. Hit counts persist across IDE/server restarts

---

#### STORY 6: Configuration Management

> As a user, I want to configure the number of tools injected (N) so that I can balance between token savings and prompt size

**Requirement Details:**

1. Configuration parameter: `tool_cache.inject_count` (default: 5)
2. Configuration can be set via MCP tool settings or steering rules
3. Configuration persists across sessions
4. Changes take effect on next sub-agent invocation (no restart required)

**Acceptance Criteria:**

1. AC8: Configuration: N (inject count) configurable via settings
2. Default value = 5 works without explicit configuration
3. Configuration changes are hot-reloadable

---

#### STORY 7: Cross-Session Persistence

> As the system, I want the cache to persist across IDE restarts and MCP server restarts so that agents benefit from historical usage data

**Requirement Details:**

1. All cache entries are stored in SQLite KB (persistent storage)
2. Cache survives IDE restart (VS Code / Kiro close and reopen)
3. Cache survives MCP server restart
4. Cache is workspace-specific (different projects have different caches)
5. No manual cache warming needed — cache builds organically from usage

**Acceptance Criteria:**

1. AC6: Cross-session persistence: cache survive IDE/server restart
2. After restart, first tool lookup hits KB cache (not find_tools)
3. Hit counts are preserved across restarts

---

#### STORY 8: Per-Agent Scope Registry

> As the system, I want to maintain separate registries per agent scope so that each agent gets tools relevant to its role

**Requirement Details:**

1. Level 1 (Global): Contains ALL tools used successfully by any agent
2. Level 2 (Per-Agent): Each sub-agent (ba-agent, sa-agent, qa-agent, dev-agent, devops-agent) has its own registry
3. Agent scope is identified by agent name tag in KB entry
4. Global scope is identified by `scope:global` tag
5. Lookup priority: agent scope first, then global scope

**Acceptance Criteria:**

1. BA agent's cache contains BA-specific tools (jira_get_issue, kb_search, kb_ingest)
2. SA agent's cache contains SA-specific tools (code analysis, architecture tools)
3. Global cache contains union of all agents' tools
4. Agent scope lookup is faster than global (smaller search space)

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| KB Server | System | N/A | Knowledge Base server must support kb_ingest and kb_search with tag filtering |
| Python MCP Server | System | N/A | Orchestration layer (find_tools, execute_dynamic_tool) must be operational |
| SQLite Database | Infrastructure | N/A | Persistent storage backend for KB entries |
| Steering Rules | System | N/A | Agent configuration infrastructure for inject_count setting |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Reporter | Duc Nguyen Minh | Feature owner, requirements validation | Jira reporter |
| Technical Lead | Duc Nguyen Minh | Architecture review, implementation oversight | Jira reporter |
| AI Agents | SM, BA, SA, QA, DEV, DevOps | End users of the cache system | System users |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Stale cache entries cause tool execution failures | Medium | Medium | Automatic invalidation on failure + re-discovery |
| KB search latency exceeds 100ms threshold | High | Low | Use tag-based filtering to narrow search space; index optimization |
| Cache flooding with too many entries | Medium | Low | Compact entry format; one entry per tool per scope |
| Tool schema changes between server versions | High | Medium | Invalidate on schema mismatch errors; consider TTL in future |
| Hit count overflow for very popular tools | Low | Low | Cap at reasonable maximum or implement decay |

### 5.2 Assumptions

- KB server is always available when MCP server is running
- Tool names are unique within a server (no two tools with same name on same server)
- Agent names are stable and consistent across sessions (e.g., always "ba-agent", not "ba-agent-v2")
- KB search with tag filtering is fast enough (< 100ms) for the expected number of cached tools (< 500 entries total)
- The existing `kb_ingest` and `kb_search` tools support all required operations (tag filtering, update by title)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | KB lookup latency < 100ms | Cache lookup must not add noticeable delay to tool execution |
| Performance | Ingestion must be non-blocking | Cache population must not delay tool execution response |
| Scalability | Support up to 500 cached tool entries | Across all agents and global scope combined |
| Reliability | Persist across restarts | SQLite-backed KB ensures durability |
| Availability | Graceful degradation | If KB is unavailable, fall back to find_tools (no cache) |
| Storage | Compact entries | Each entry < 2KB to avoid KB flooding |
| Security | No sensitive data in cache | Only tool metadata (names, schemas), no execution results |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-139 | 2-Level Agent Tool Cache Registry — KB-based tool discovery cache | To Do | Task | Main ticket |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Tool Cache | KB entries storing tool metadata for fast lookup |
| Global Scope (Level 1) | Cache entries accessible by all agents |
| Agent Scope (Level 2) | Cache entries specific to one agent |
| Hit Count | Number of successful executions of a cached tool |
| Startup Injection | Pre-loading top-N tools into sub-agent prompt at invocation time |
| Lookup Cascade | Sequential search: agent scope → global scope → find_tools |
| Cache Invalidation | Removing stale entries after tool execution failure |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| Orchestration Architecture | .kiro/steering/orchestration.md |
| MCP Server Configuration | .code-intel/orchestration.json |
| KB Server API | kb_ingest, kb_search tools |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
