# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-63: Fix Tool Discovery, Semantic Grouping & Fallback Chain Execution

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-63 |
| Title | Fix Tool Discovery, Semantic Grouping & Fallback Chain Execution |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-63.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-14 | BA Agent | Initiate document — functional specs from BRD |
| 1.1 | 2025-07-14 | TA Agent | Enriched with API contracts, pseudocode, technical review |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the redesigned tool discovery, semantic grouping, and fallback chain execution system within the MCP Code Intelligence Kotlin orchestration layer.

### 1.2 Scope

Covers modifications to:
- `FindToolsTool.kt` — semantic search replacing substring matching
- `UnifiedRegistry.kt` — semantic grouping and chain building
- `OrchestrationEngine.kt` — recursive nested discovery and KB-unified search
- `ExecuteDynamicTool.kt` — fallback chain execution with priority ordering
- `SmartRouter.kt` — timeout propagation during chain execution
- `ToolDispatcher.kt` — chain-aware routing

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| Fallback Chain | Ordered list of servers providing equivalent functionality for a tool |
| Semantic Grouping | Grouping tools by description similarity (not just exact name) |
| Nested Orchestrator | Child MCP server that is itself an orchestrator with sub-children |
| Priority | Numeric order for execution preference (lower = tried first) |
| KB | Knowledge Base — persistent memory store |
| Token | Individual word/term extracted from a query or description |
| BM25 | Best Matching 25 — probabilistic text retrieval algorithm |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-63.docx |
| Orchestration Config | `.code-intel/orchestration.json` |
| Current FindToolsTool | `orchestration/meta/FindToolsTool.kt` |
| Current UnifiedRegistry | `orchestration/registry/UnifiedRegistry.kt` |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

The orchestration engine sits between AI agents (consumers) and multiple MCP servers (providers). It provides:
1. **Discovery** — finds and indexes tools from all servers (including nested)
2. **Search** — semantic search across all indexed tools
3. **Routing** — directs tool calls to the correct server with fallback
4. **Execution** — executes tools with automatic failover on error

### 2.2 System Architecture

Components involved:
- **OrchestrationEngine** — coordinator, startup, lifecycle
- **UnifiedRegistry** — tool index, chain storage, search
- **FindToolsTool** — meta-tool exposed to agents for search
- **ExecuteDynamicTool** — meta-tool for executing any tool by name
- **SmartRouter** — routes calls to correct server with timeout
- **LocalServerManager** — manages child server processes
- **MemoryEngine (KB)** — persistent tool definition storage


---

## 3. Functional Requirements

### 3.1 Feature: Semantic Tool Search (find_tools)

**Source:** BRD Story 1, Story 5

#### 3.1.1 Description

Replace the current substring `contains()` search in `FindToolsTool` with a tokenized, scored search that matches query terms against tool name tokens AND description tokens. Additionally, search the KB for tool definitions ingested from previous sessions.

#### 3.1.2 Use Case

**Use Case ID:** UC-1
**Actor:** AI Agent
**Preconditions:** OrchestrationEngine is started, tools are registered in UnifiedRegistry
**Postconditions:** Agent receives ranked list of matching tools with definitions

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls `find_tools(query: "search issues")` | | Agent provides natural language query |
| 2 | | Tokenize query into terms: ["search", "issues"] | Split on whitespace, lowercase, remove stopwords |
| 3 | | Score each registered tool against query terms | Match terms against name tokens + description tokens |
| 4 | | Search KB for entries tagged "tools,registry" | Hybrid search (BM25 + vector) in memory engine |
| 5 | | Merge registry results + KB results | Deduplicate by tool name, keep highest score |
| 6 | | Sort by relevance score descending | Name matches weighted 2x vs description matches |
| 7 | | Return top-K results (default 10) | Each result includes full tool definition JSON |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | Empty query string | Return all enabled tools (no filtering), limited to top-K |
| AF-2 | KB unavailable (engine down) | Log warning, return registry-only results |
| AF-3 | No matches found | Return empty array `[]` |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Query is null/missing | Return error JSON: `{"error": "Missing 'query'"}` |
| EF-2 | Registry is empty (no tools registered) | Return empty array, log warning |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-1 | Query terms are matched case-insensitively | BRD Story 1 |
| BR-2 | Tool name token match scores 2x vs description token match | BRD Story 1 |
| BR-3 | Results are deduplicated by tool name (highest score wins) | BRD Story 5 |
| BR-4 | Disabled tools (via toggle) are excluded from results | Existing behavior |
| BR-5 | Meta-tools (find_tools, execute_dynamic_tool, etc.) are excluded from search results | Existing behavior |
| BR-6 | Stopwords ("a", "the", "is", "to", "for", "and", "or", "in", "on", "with") are removed from query | New requirement |

#### 3.1.4 Data Specifications

**Input Data:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| query | String | Yes | Non-null, trimmed | Natural language search query |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| results | JsonArray | Array of tool definition objects |
| results[].name | String | Tool name |
| results[].description | String | Tool description |
| results[].inputSchema | JsonObject | Tool input parameter schema |
| results[].source | String | Server that provides this tool |
| results[].score | Double | Relevance score (0.0 - 1.0) |

#### 3.1.5 API Contract (Functional View)

**Tool:** `find_tools`
**Purpose:** Search for available tools by describing what you want to accomplish

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| query | String | Yes | BR-1, BR-6 | Natural language description or keyword |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| (root) | JsonArray | Array of matching tool definitions |
| [].name | String | Tool name identifier |
| [].description | String | Tool description text |
| [].inputSchema | Object | JSON Schema for tool parameters |

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| Missing query | `{"error": "Missing 'query'"}` | query parameter not provided |
| No results | `[]` | No tools match the query terms |

#### 3.1.6 Scoring Algorithm (Pseudocode)

```
function scoreToolAgainstQuery(tool, queryTerms):
    nameTokens = tokenize(tool.name)        // e.g., "jira_search" → ["jira", "search"]
    descTokens = tokenize(tool.description)  // e.g., "Search issues using JQL" → ["search", "issues", "using", "jql"]
    
    score = 0.0
    matchedTerms = 0
    
    for term in queryTerms:
        if term in nameTokens:
            score += 2.0    // Name match = 2x weight
            matchedTerms++
        elif term in descTokens:
            score += 1.0    // Description match = 1x weight
            matchedTerms++
    
    // Normalize: proportion of query terms matched
    if queryTerms.size > 0:
        score = score / (queryTerms.size * 2.0)  // Max possible = all terms match name
    
    return score if matchedTerms > 0 else 0.0
```

```
function tokenize(text):
    // Split on non-alphanumeric (underscore, hyphen, space, camelCase boundaries)
    tokens = text.split(/[^a-zA-Z0-9]+/)
    tokens += splitCamelCase(text)  // "getUserName" → ["get", "user", "name"]
    return tokens.map(lowercase).filter(not in STOPWORDS).distinct()
```


---

### 3.2 Feature: Semantic Fallback Chain Grouping

**Source:** BRD Story 2

#### 3.2.1 Description

After all tools are discovered, analyze tool descriptions for semantic similarity and group functionally-equivalent tools into fallback chains. Currently, chains are only built for exact name matches. The new system groups tools by description similarity as well.

#### 3.2.2 Use Case

**Use Case ID:** UC-2
**Actor:** OrchestrationEngine (internal, on startup)
**Preconditions:** All child servers discovered, tools registered in UnifiedRegistry
**Postconditions:** Fallback chains built and stored for O(1) lookup during execution

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Collect all registered child tools | From UnifiedRegistry.childTools |
| 2 | | Group by exact name (existing behavior) | Tools with same name on different servers |
| 3 | | For remaining ungrouped tools, compute pairwise description similarity | Tokenized Jaccard similarity |
| 4 | | Group tools with similarity > 0.7 threshold | Create chain with canonical name = highest-priority tool's name |
| 5 | | Order each chain by server priority (config index) | Lower index = higher priority = tried first |
| 6 | | Store chains in registry for O(1) lookup | Map<toolName, ToolChain> |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | Only 1 server provides a tool (no duplicates) | No chain created, tool routes directly |
| AF-2 | Similarity computation fails for a pair | Skip that pair, log warning, continue |
| AF-3 | Config hot-reloaded | Rebuild all chains with new priority order |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Tool has empty description | Exclude from semantic grouping (only exact-name grouping applies) |
| EF-2 | Circular similarity (A~B, B~C, but A!~C) | Use transitive closure — all go in same chain |

#### 3.2.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-7 | Exact name match always creates a chain (regardless of description) | Existing behavior |
| BR-8 | Semantic similarity threshold = 0.7 (configurable) | BRD Story 2 |
| BR-9 | Chain priority = server config declaration order (index 0 = highest) | BRD Story 4 |
| BR-10 | Native tools (priority -1) always win over child tools | Existing behavior |
| BR-11 | Chain is rebuilt on config hot-reload | BRD Story 4 |
| BR-12 | Tools with empty descriptions are excluded from semantic grouping | New requirement |

#### 3.2.4 Data Specifications

**ToolChain Entity:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| toolName | String | Yes | Canonical name (from highest-priority entry) |
| entries | List<ChainEntry> | Yes | Ordered server list |
| groupingReason | String | Yes | "exact_name" or "semantic_similarity:0.85" |
| similarNames | List<String> | No | Alternative tool names in this chain |

**ChainEntry Entity:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| serverName | String | Yes | Server identifier |
| priority | Int | Yes | Execution order (lower = first) |
| toolName | String | Yes | Actual tool name on this server (may differ from canonical) |

#### 3.2.5 Similarity Algorithm (Pseudocode)

```
function computeSimilarity(toolA, toolB):
    tokensA = tokenize(toolA.name + " " + toolA.description)
    tokensB = tokenize(toolB.name + " " + toolB.description)
    
    intersection = tokensA.intersect(tokensB)
    union = tokensA.union(tokensB)
    
    if union.isEmpty(): return 0.0
    
    // Weighted Jaccard: name tokens count double
    nameTokensA = tokenize(toolA.name)
    nameTokensB = tokenize(toolB.name)
    nameOverlap = nameTokensA.intersect(nameTokensB).size
    
    jaccardScore = intersection.size.toDouble() / union.size.toDouble()
    nameBonus = nameOverlap * 0.1  // Bonus for name overlap
    
    return min(1.0, jaccardScore + nameBonus)
```

```
function buildSemanticChains(tools):
    // Step 1: Group by exact name (existing)
    exactGroups = tools.groupBy { it.name }
    chains = exactGroups.filter { it.value.size >= 2 }
                        .map { createChain(it.key, it.value, "exact_name") }
    
    // Step 2: Semantic grouping for remaining ungrouped tools
    ungrouped = tools.filter { it not in any chain }
    
    for i in 0..ungrouped.size-1:
        for j in i+1..ungrouped.size-1:
            sim = computeSimilarity(ungrouped[i], ungrouped[j])
            if sim >= SIMILARITY_THRESHOLD:
                mergeIntoChain(ungrouped[i], ungrouped[j], "semantic_similarity:$sim")
    
    return chains
```

---

### 3.3 Feature: Recursive Nested Orchestrator Discovery

**Source:** BRD Story 3

#### 3.3.1 Description

After initial `tools/list` from a child server, detect if the server is a nested orchestrator (has meta-tools). If so, recursively discover its child tools, tagging them with depth level for priority calculation.

#### 3.3.2 Use Case

**Use Case ID:** UC-3
**Actor:** OrchestrationEngine (internal, on startup)
**Preconditions:** Child server is active and responding
**Postconditions:** All nested tools registered with correct depth and priority

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Call `tools/list` on child server | Standard MCP discovery |
| 2 | | Check if response contains meta-tools | Look for "find_tools" or "execute_dynamic_tool" in tool names |
| 3 | | If nested orchestrator: call its `find_tools("")` | Empty query = enumerate all tools |
| 4 | | Parse response as list of tool definitions | Each tool tagged with source server + depth |
| 5 | | Check depth < maxRecursionDepth | Prevent infinite loops |
| 6 | | Register nested tools with priority = configIndex * 100 + depth | Deeper = lower priority |
| 7 | | Add to visited set to prevent circular references | Track server identifiers |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | Server is NOT a nested orchestrator | Register its tools directly (depth 0), skip recursion |
| AF-2 | maxRecursionDepth reached | Stop recursion, log info, register tools discovered so far |
| AF-3 | Circular reference detected (server already in visited set) | Skip, log warning |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Nested server timeout during discovery | Log error, skip nested tools, keep direct tools |
| EF-2 | Nested server returns invalid response | Log error, skip, continue with other servers |
| EF-3 | find_tools on nested server returns error | Treat as non-orchestrator, register direct tools only |

#### 3.3.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-13 | Nested orchestrator detected by presence of "find_tools" in tools/list response | BRD Story 3 |
| BR-14 | maxRecursionDepth default = 3, configurable (1-5) | BRD Story 3 |
| BR-15 | Priority formula: configIndex * 100 + depth | BRD Story 3 |
| BR-16 | Circular references prevented by visited-set tracking | BRD Story 3 |
| BR-17 | Discovery timeout per server = 10s (configurable) | BRD Story 3 |
| BR-18 | Failed nested discovery does not block other servers | BRD Story 3 |

#### 3.3.4 Discovery Algorithm (Pseudocode)

```
function discoverRecursive(serverName, configIndex, depth, visited):
    if depth > maxRecursionDepth: return []
    if serverName in visited: return []  // Circular reference
    
    visited.add(serverName)
    
    // Step 1: Get direct tools
    directTools = callToolsList(serverName)  // MCP tools/list
    
    // Step 2: Check if nested orchestrator
    toolNames = directTools.map { it.name }
    isNested = "find_tools" in toolNames || "execute_dynamic_tool" in toolNames
    
    if !isNested:
        // Register direct tools at current depth
        return directTools.map { RegisteredTool(it, serverName, configIndex * 100 + depth) }
    
    // Step 3: Recursively discover nested tools
    nestedTools = []
    try:
        response = callTool(serverName, "find_tools", {query: ""})
        nestedToolDefs = parseToolDefinitions(response)
        
        for nestedTool in nestedToolDefs:
            nestedTools.add(RegisteredTool(
                nestedTool, 
                source = "child:$serverName:depth${depth+1}",
                priority = configIndex * 100 + depth + 1
            ))
    catch timeout/error:
        log("Nested discovery failed for $serverName, using direct tools only")
    
    // Register both direct tools (excluding meta-tools) and nested tools
    result = directTools
        .filter { it.name not in META_TOOL_NAMES }
        .map { RegisteredTool(it, serverName, configIndex * 100 + depth) }
    result += nestedTools
    
    return result
```


---

### 3.4 Feature: Fallback Chain Execution with Priority Order

**Source:** BRD Story 2, Story 4

#### 3.4.1 Description

When executing a tool via `execute_dynamic_tool`, if the tool has a fallback chain, try servers in priority order. If one fails, automatically try the next. Report aggregated errors if all fail.

#### 3.4.2 Use Case

**Use Case ID:** UC-4
**Actor:** AI Agent
**Preconditions:** Tool has a fallback chain with ≥2 entries
**Postconditions:** Tool executed successfully on one server, or all-failed error returned

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls `execute_dynamic_tool(tool_name, args)` | | Agent provides tool name and arguments |
| 2 | | Lookup chain for tool_name in registry | O(1) map lookup |
| 3 | | If chain exists: iterate entries by priority (ascending) | Priority 0 first, then 1, 2... |
| 4 | | Call tool on current server with remaining timeout | Subtract elapsed time from total timeout |
| 5 | | If success: return result immediately | Short-circuit on first success |
| 6 | | If error: log failure, try next server in chain | Record error for aggregation |
| 7 | | If all servers exhausted: return aggregated error | List all servers and their individual errors |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | Tool has no chain (single server) | Route directly to that server, no fallback |
| AF-2 | Tool not found in registry at all | Try all child servers sequentially (discovery fallback) |
| AF-3 | Chain has entries but tool name differs on some servers | Use the server-specific tool name from ChainEntry |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-1 | Timeout exhausted before trying all servers | Return timeout error with servers attempted so far |
| EF-2 | Server in chain is offline (connection refused) | Skip immediately (< 100ms), try next |
| EF-3 | All servers return different errors | Aggregate all errors in response |

#### 3.4.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-19 | Execution order follows chain priority ascending | BRD Story 4 |
| BR-20 | Timeout is propagated: each hop subtracts elapsed time | Existing SmartRouter behavior |
| BR-21 | Connection-refused errors are fast-failed (< 100ms) | Performance requirement |
| BR-22 | Successful execution short-circuits (no further servers tried) | BRD Story 2 |
| BR-23 | Aggregated error includes all server names and their errors | BRD Story 4 |

#### 3.4.4 API Contract (Functional View)

**Tool:** `execute_dynamic_tool`
**Purpose:** Execute any registered tool by name with automatic fallback

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| tool_name | String | Yes | — | Exact tool name to execute |
| arguments | Object | No | — | Arguments to pass to the tool |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| (root) | String/Object | Tool execution result (pass-through from server) |

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| Missing tool_name | `{"error": "Missing 'tool_name'"}` | tool_name parameter not provided |
| All servers failed | `{"error": "Tool 'X' failed on all N servers in chain"}` | Every server in chain returned error |
| Tool not found anywhere | `{"error": "Tool 'X' not found in any server"}` | Not in registry, not on any child |
| Timeout exhausted | `{"error": "Timeout exhausted before routing to server 'Y'"}` | Remaining timeout ≤ 0 |

#### 3.4.5 Execution Algorithm (Pseudocode)

```
function executeWithFallback(toolName, args, totalTimeout):
    chain = registry.getChain(toolName)
    startTime = now()
    errors = []
    
    if chain == null:
        // No chain — try direct routing or all-children fallback
        return routeDirectOrFallback(toolName, args, totalTimeout)
    
    for entry in chain.entries:  // Sorted by priority ascending
        elapsed = now() - startTime
        remaining = totalTimeout - elapsed
        
        if remaining <= 0:
            return error("Timeout exhausted after trying ${errors.size} servers")
        
        try:
            result = callChild(entry.serverName, entry.toolName ?: toolName, args, remaining)
            log("$toolName succeeded on ${entry.serverName}")
            return result
        catch e:
            errors.add("${entry.serverName}: ${e.message}")
            log("$toolName failed on ${entry.serverName}: ${e.message}, trying next...")
    
    return error("Tool '$toolName' failed on all ${chain.entries.size} servers: ${errors}")
```

---

### 3.5 Feature: Unified KB + Registry Search

**Source:** BRD Story 5

#### 3.5.1 Description

`find_tools` currently only searches the in-memory UnifiedRegistry. The KB (memory engine) also contains tool definitions ingested at startup. Unify both search paths so agents can find tools regardless of where they're indexed.

#### 3.5.2 Use Case

**Use Case ID:** UC-5
**Actor:** AI Agent (via find_tools)
**Preconditions:** Tools ingested in KB during startup, registry populated
**Postconditions:** Merged, deduplicated results from both sources

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Search UnifiedRegistry with tokenized query | Fast in-memory search |
| 2 | | Search KB with same query (BM25 + vector) | Memory engine hybrid search |
| 3 | | Parse KB results to extract tool definitions | KB entries contain "name [source]: description" format |
| 4 | | Merge results, deduplicate by tool name | Keep entry with highest score |
| 5 | | Return unified sorted results | Combined ranking |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-1 | KB engine is null/unavailable | Return registry-only results, log warning |
| AF-2 | KB returns no results | Return registry-only results |
| AF-3 | KB result has tool not in registry | Include it (may be from previous session) |

#### 3.5.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-24 | Registry search is always performed (primary source) | BRD Story 5 |
| BR-25 | KB search is best-effort (graceful degradation if unavailable) | BRD Story 5 |
| BR-26 | Deduplication: same tool name → keep highest-scoring entry | BRD Story 5 |
| BR-27 | KB search timeout = 2000ms (don't block find_tools) | NFR |


---

## 4. Data Model

### 4.1 Logical Entities

#### Entity: RegisteredTool

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| name | String | Yes | — | Tool identifier |
| definition | JsonObject | Yes | — | Full MCP tool definition (name, description, inputSchema) |
| source | String | Yes | — | Origin: "native", "child:{serverName}", "child:{server}:depth{N}" |
| priority | Int | Yes | BR-9, BR-15 | Execution priority (lower = higher priority) |
| nameTokens | List<String> | Yes | BR-1 | Pre-computed tokenized name for search |
| descTokens | List<String> | Yes | BR-1 | Pre-computed tokenized description for search |

#### Entity: ToolChain

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| toolName | String | Yes | — | Canonical tool name (from highest-priority entry) |
| entries | List<ChainEntry> | Yes | BR-9 | Ordered list of servers, sorted by priority |
| groupingReason | String | Yes | BR-7, BR-8 | Why grouped: "exact_name" or "semantic_similarity:0.85" |
| similarNames | List<String> | No | — | Alternative names that map to this chain |

#### Entity: ChainEntry

| Attribute | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| serverName | String | Yes | — | Server identifier |
| priority | Int | Yes | BR-9 | Config-derived priority |
| toolName | String | No | — | Server-specific tool name (if different from canonical) |

**Relationships:**

| From Entity | To Entity | Cardinality | Description |
|-------------|-----------|-------------|-------------|
| ToolChain | ChainEntry | 1:N | Chain contains multiple server entries |
| UnifiedRegistry | RegisteredTool | 1:N | Registry holds all tools |
| UnifiedRegistry | ToolChain | 1:N | Registry holds all chains |

---

## 5. Integration Specifications

### 5.1 External System: Child MCP Servers

| Attribute | Value |
|-----------|-------|
| Purpose | Provide tool implementations for AI agents |
| Direction | Bidirectional (discovery + execution) |
| Data Format | JSON (MCP protocol) |
| Frequency | Real-time (on-demand) |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| tools/list request | Tool definitions array | Receive | Standard MCP discovery |
| tools/call request | Tool execution result | Receive | Execution with timeout |
| find_tools("") request | All nested tools | Receive | BR-13 (nested discovery) |

### 5.2 External System: Memory Engine (KB)

| Attribute | Value |
|-----------|-------|
| Purpose | Persistent storage for tool definitions, enabling cross-session search |
| Direction | Bidirectional (ingest + search) |
| Data Format | Text content with tags |
| Frequency | Ingest on startup; search on-demand |

**Data Exchange:**

| Our Data | External Data | Direction | Business Rule |
|----------|--------------|-----------|---------------|
| Tool definitions (name + desc + source) | KB entry ID | Send (ingest) | BR-24 |
| Search query | Matching entries | Receive (search) | BR-25, BR-27 |

---

## 6. Processing Logic

### 6.1 Startup Discovery Process

**Trigger:** OrchestrationEngine.start() called
**Input:** orchestration.json config with server declarations
**Output:** Fully populated UnifiedRegistry with chains

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Read config, extract server order | Fail startup if config invalid |
| 2 | Set server order in registry | — |
| 3 | Start all child server processes | Log failed servers, continue with others |
| 4 | For each active server: discover tools (recursive) | Timeout per server, skip on failure |
| 5 | Register all discovered tools in registry | — |
| 6 | Build semantic fallback chains | Log warnings for failed similarity computations |
| 7 | Ingest tool definitions into KB | Best-effort, log if KB unavailable |
| 8 | Start config watcher for hot-reload | — |

### 6.2 Chain Rebuild Process

**Trigger:** Config hot-reload detected by ConfigWatcher
**Input:** New orchestration.json content
**Output:** Updated registry with new priorities and chains

**Processing Steps:**

| Step | Description | Error Handling |
|------|-------------|----------------|
| 1 | Parse new config | If invalid, keep old config, log error |
| 2 | Stop all current child servers | — |
| 3 | Update server manager with new config | — |
| 4 | Set new server order in registry | — |
| 5 | Start all servers from new config | Log failed, continue |
| 6 | Rebuild routing table | — |
| 7 | Rebuild semantic chains with new priorities | — |
| 8 | Re-ingest tools to KB | — |

---

## 7. Security Requirements

### 7.1 Authentication & Authorization

| Role | Permissions | Features |
|------|-------------|----------|
| AI Agent | Execute any tool via meta-tools | find_tools, execute_dynamic_tool |
| Config Admin | Modify orchestration.json | Server order, thresholds, timeouts |

### 7.2 Data Sensitivity

| Data Type | Classification | Business Requirement |
|-----------|---------------|---------------------|
| Tool definitions | Internal | Not sensitive — tool names and descriptions |
| Execution arguments | Confidential | May contain user data — not logged in full |
| Server connection details | Restricted | Stored in config only, not exposed via API |

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | find_tools responds quickly | < 200ms for 500 registered tools |
| Performance | Startup discovery completes promptly | < 15s for 10 servers with depth ≤ 3 |
| Performance | Fallback hop overhead is minimal | < 100ms per hop (excluding tool execution) |
| Reliability | Single server failure doesn't break system | Other tools remain functional |
| Reliability | KB unavailability doesn't break find_tools | Graceful fallback to registry-only |
| Scalability | Support large tool registries | Up to 500 tools across 10 servers |
| Configurability | All thresholds are configurable | similarity_threshold, maxRecursionDepth, timeouts |

---

## 9. Error Handling (User-Facing)

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| Tool not found | Warning | `{"error": "Tool 'X' not found in any server"}` | Agent should try different tool name |
| All servers failed | Critical | `{"error": "Tool 'X' failed on all N servers in chain"}` | Agent should report to user |
| Timeout exhausted | Warning | `{"error": "Timeout exhausted..."}` | Agent can retry with longer timeout |
| Missing parameter | Info | `{"error": "Missing 'tool_name'"}` | Agent should provide required param |
| Discovery failed | Warning | Logged internally, not exposed | System continues with available tools |

---

## 10. Testing Considerations

### 10.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-1 | Semantic search finds tool by description keyword | query="search issues" | Returns jira_search tool | High |
| TC-2 | Exact name match still works | query="code_search" | Returns code_search tool | High |
| TC-3 | Empty query returns all tools | query="" | Returns all enabled tools | Medium |
| TC-4 | Fallback chain executes on second server after first fails | First server throws error | Result from second server | High |
| TC-5 | All servers in chain fail | All servers throw | Aggregated error message | High |
| TC-6 | Nested orchestrator tools discovered | Child has find_tools | Nested tools in registry | High |
| TC-7 | maxRecursionDepth prevents infinite loop | Circular reference | Discovery stops at max depth | High |
| TC-8 | Config hot-reload updates priorities | New config with reversed order | Chain priorities updated | Medium |
| TC-9 | KB unavailable doesn't break find_tools | KB engine null | Registry results returned | Medium |
| TC-10 | Semantic grouping creates chain for similar tools | Two tools with similar desc | Chain with both entries | High |

---

## 11. Appendix

### Sequence Diagram — find_tools Search Flow

![Sequence - find_tools](diagrams/sequence-find-tools.png)

### State Diagram — Tool Chain Lifecycle

![State - Chain Lifecycle](diagrams/state-chain-lifecycle.png)

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence — find_tools | [sequence-find-tools.png](diagrams/sequence-find-tools.png) | [sequence-find-tools.drawio](diagrams/sequence-find-tools.drawio) |
| 3 | State — Chain Lifecycle | [state-chain-lifecycle.png](diagrams/state-chain-lifecycle.png) | [state-chain-lifecycle.drawio](diagrams/state-chain-lifecycle.drawio) |

### Change Log from BRD

- Added detailed pseudocode for scoring algorithm (not in BRD)
- Added tokenization rules including camelCase splitting and stopword removal
- Added transitive closure rule for semantic grouping (EF-2 in UC-2)
- Specified KB search timeout of 2000ms (derived from NFR)
- Added ChainEntry.toolName field to support different tool names across servers in same chain
