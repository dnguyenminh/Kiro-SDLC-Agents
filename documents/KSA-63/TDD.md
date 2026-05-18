# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-63: Fix Tool Discovery, Semantic Grouping & Fallback Chain Execution

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-63 |
| Title | Fix Tool Discovery, Semantic Grouping & Fallback Chain Execution |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-63.docx |
| Related FSD | FSD-v1-KSA-63.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-14 | SA Agent | Initiate document — technical design from FSD |

---

## 1. Introduction

### 1.1 Purpose

This TDD specifies the technical implementation for fixing the orchestration layer's tool discovery, semantic grouping, and fallback chain execution. It covers modifications to 6 existing Kotlin files and creation of 2 new utility classes.

### 1.2 Scope

**Files to modify:**
- `FindToolsTool.kt` — replace substring search with tokenized scoring
- `UnifiedRegistry.kt` — add semantic chain building, pre-computed tokens
- `OrchestrationEngine.kt` — add recursive discovery, unified KB search
- `ExecuteDynamicTool.kt` — support server-specific tool names in chains
- `SmartRouter.kt` — no changes needed (already supports timeout propagation)
- `ToolDispatcher.kt` — no changes needed (already delegates to chain)

**New files to create:**
- `Tokenizer.kt` — text tokenization utility (split, lowercase, stopwords, camelCase)
- `SemanticGrouper.kt` — similarity computation and chain building logic

### 1.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | Kotlin | 1.9.x |
| Runtime | JVM | 17+ |
| Serialization | kotlinx.serialization | 1.6.x |
| Concurrency | kotlinx.coroutines | 1.7.x |
| Build Tool | Gradle (Kotlin DSL) | 8.x |
| Process Management | ProcessBuilder (JDK) | — |
| Memory/KB | SQLite + FTS5 | 3.x |

### 1.4 Design Principles

- **Single Responsibility** — Tokenizer and SemanticGrouper are separate from Registry
- **Open/Closed** — New grouping strategies can be added without modifying existing chain logic
- **Fail-fast with graceful degradation** — KB unavailable → registry-only; server offline → skip in chain
- **Configuration over code** — All thresholds configurable in orchestration.json
- **Max 200 lines per file, max 20 lines per function** — per project coding standards

### 1.5 Constraints

- File size limit: 200 lines per `.kt` file
- Function size limit: 20 lines per function
- No external dependencies beyond existing (kotlinx.serialization, kotlinx.coroutines)
- Must maintain backward compatibility with existing orchestration.json format
- Must not break existing `tools/list` response (meta-tools still hidden)

### 1.6 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-63.docx |
| FSD | FSD-v1-KSA-63.docx |
| Kotlin Code Standards | `.kiro/steering/kotlin-code-standards.md` |
| No Workaround Rule | `.kiro/steering/no-workaround-rule.md` |


---

## 2. System Architecture

### 2.1 Architecture Overview

![Architecture Diagram](diagrams/architecture.png)

The orchestration layer follows a layered architecture:

1. **Meta-Tool Layer** — `FindToolsTool`, `ExecuteDynamicTool` (entry points for agents)
2. **Registry Layer** — `UnifiedRegistry` (tool index + chain storage)
3. **Grouping Layer** — `SemanticGrouper` (NEW — similarity computation)
4. **Utility Layer** — `Tokenizer` (NEW — text processing)
5. **Routing Layer** — `SmartRouter`, `RoutingTable` (execution routing)
6. **Server Layer** — `LocalServerManager` (child process management)
7. **Storage Layer** — `MemoryEngine` (KB persistence)

### 2.2 Component Diagram

![Component Diagram](diagrams/component.png)

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| FindToolsTool | Semantic search meta-tool | Kotlin, kotlinx.serialization |
| UnifiedRegistry | Tool index, chain storage, toggle management | Kotlin, ConcurrentHashMap |
| SemanticGrouper | Compute similarity, build chains | Kotlin (pure logic) |
| Tokenizer | Text tokenization, stopword removal | Kotlin (pure logic) |
| OrchestrationEngine | Lifecycle, recursive discovery, KB ingest | Kotlin, coroutines |
| ExecuteDynamicTool | Chain-aware execution with fallback | Kotlin, coroutines |
| SmartRouter | Route to server with timeout propagation | Kotlin, coroutines |
| LocalServerManager | Start/stop child MCP server processes | Kotlin, ProcessBuilder |
| MemoryEngine | Persistent KB storage and search | SQLite, FTS5 |

### 2.3 Communication Patterns

| From | To | Protocol | Pattern | Description |
|------|----|----------|---------|-------------|
| AI Agent | FindToolsTool | MCP tools/call | Sync | Agent searches for tools |
| AI Agent | ExecuteDynamicTool | MCP tools/call | Sync | Agent executes a tool |
| OrchestrationEngine | LocalServerManager | Internal | Sync | Start/stop servers |
| SmartRouter | Child MCP Server | stdio JSON-RPC | Sync (with timeout) | Execute tool on child |
| OrchestrationEngine | MemoryEngine | Internal | Sync | Ingest/search KB |
| FindToolsTool | UnifiedRegistry | Internal | Sync | Search registered tools |
| FindToolsTool | MemoryEngine | Internal | Sync (2s timeout) | Search KB for tools |
| SemanticGrouper | Tokenizer | Internal | Sync | Tokenize descriptions |

---

## 3. API Design

### 3.1 API Overview

No external HTTP APIs. All interactions are via MCP protocol (JSON-RPC over stdio). The two meta-tools are:

| # | Tool Name | Description | Source |
|---|-----------|-------------|--------|
| 1 | find_tools | Semantic search for tools | UC-1, UC-5 |
| 2 | execute_dynamic_tool | Execute tool with fallback chain | UC-4 |

### 3.2 Tool: find_tools (Redesigned)

**Implements:** UC-1, UC-5, BR-1 through BR-6, BR-24 through BR-27

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Natural language description or keyword to search for"
    }
  },
  "required": ["query"]
}
```

**Response — Success:**

```json
[
  {
    "name": "jira_search",
    "description": "Search issues using JQL query language",
    "inputSchema": { "type": "object", "properties": { "jql": { "type": "string" } } }
  }
]
```

**Response — Error:**

```json
{"error": "Missing 'query'"}
```

### 3.3 Tool: execute_dynamic_tool (Enhanced)

**Implements:** UC-4, BR-19 through BR-23

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "tool_name": { "type": "string", "description": "Exact tool name to execute" },
    "arguments": { "type": "object", "description": "Arguments for the tool" }
  },
  "required": ["tool_name"]
}
```

**Response — Success:** Pass-through from child server (any JSON)

**Error Responses:**

| Condition | Error Message |
|-----------|--------------|
| Missing tool_name | `{"error": "Missing 'tool_name'"}` |
| All servers failed | `{"error": "Tool 'X' failed on all N servers in chain: [server1: err1, server2: err2]"}` |
| Tool not found | `{"error": "Tool 'X' not found in any server"}` |
| Timeout exhausted | `{"error": "Timeout exhausted before routing to server 'Y' (elapsed: Nms)"}` |


---

## 4. Data Design

No database tables. All data is in-memory (UnifiedRegistry) with optional KB persistence (MemoryEngine SQLite).

### 4.1 In-Memory Data Structures

#### RegisteredTool (Enhanced)

```kotlin
data class RegisteredTool(
    val name: String,
    val definition: JsonObject,
    val source: String,          // "native", "child:serverName", "child:server:depth1"
    val priority: Int = 0,
    val nameTokens: Set<String>,  // NEW: pre-computed tokenized name
    val descTokens: Set<String>   // NEW: pre-computed tokenized description
)
```

#### ToolChain (Enhanced)

```kotlin
data class ToolChain(
    val toolName: String,              // Canonical name (highest-priority entry)
    val entries: List<ChainEntry>,     // Ordered by priority ascending
    val groupingReason: String,        // "exact_name" or "semantic_similarity:0.85"
    val similarNames: Set<String>      // NEW: alternative names that map to this chain
)

data class ChainEntry(
    val serverName: String,
    val priority: Int,
    val toolName: String? = null  // NEW: server-specific name if different from canonical
)
```

#### OrchestrationConfig (Enhanced)

```kotlin
// New fields in settings section of orchestration.json
data class OrchestrationSettings(
    val autoLog: Boolean = true,
    val similarityThreshold: Double = 0.7,    // NEW
    val maxRecursionDepth: Int = 3,           // NEW (was hardcoded in Config)
    val discoveryTimeoutMs: Long = 10_000,    // NEW
    val kbSearchTimeoutMs: Long = 2_000       // NEW
)
```

### 4.2 KB Storage Format

Tool definitions are ingested as a single KB entry per startup:

```
Content: "tool_name [source]: description\ntool_name2 [source2]: description2\n..."
Tags: "tools,registry,orchestration"
Type: "CONTEXT"
Tier: "WORKING"
Source: "orchestration-startup"
```

This format is already implemented in `ingestToolsToKb()` — no change needed for ingestion format.

---

## 5. Class / Module Design

### 5.1 Package Structure

```
com.codeintel.orchestration/
├── meta/
│   ├── FindToolsTool.kt          # MODIFY — use Tokenizer + KB search
│   ├── ExecuteDynamicTool.kt     # MODIFY — support ChainEntry.toolName
│   └── MetaToolDispatcher.kt    # NO CHANGE
├── registry/
│   ├── UnifiedRegistry.kt       # MODIFY — pre-compute tokens, delegate grouping
│   ├── SemanticGrouper.kt       # NEW — similarity + chain building
│   └── Tokenizer.kt             # NEW — text tokenization utility
├── routing/
│   ├── SmartRouter.kt           # NO CHANGE
│   └── RoutingTable.kt          # NO CHANGE
├── local/
│   ├── LocalServerManager.kt    # NO CHANGE
│   └── ConfigWatcher.kt         # NO CHANGE
├── logging/
│   └── AutoLogger.kt            # NO CHANGE
└── OrchestrationEngine.kt       # MODIFY — recursive discovery, unified search
```

### 5.2 New Class: Tokenizer

**File:** `orchestration/registry/Tokenizer.kt`
**Lines:** ~60

```kotlin
package com.codeintel.orchestration.registry

/**
 * Text tokenizer for tool search — splits text into normalized tokens.
 * Handles: underscore_case, camelCase, hyphen-case, spaces.
 */
object Tokenizer {
    private val STOPWORDS = setOf(
        "a", "an", "the", "is", "are", "was", "were", "be", "been",
        "to", "for", "and", "or", "in", "on", "with", "from", "by",
        "of", "at", "as", "it", "its", "this", "that", "not", "no"
    )
    
    private val SPLIT_REGEX = Regex("[^a-zA-Z0-9]+")
    private val CAMEL_REGEX = Regex("(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])")

    /** Tokenize text into normalized, deduplicated, stopword-free tokens. */
    fun tokenize(text: String): Set<String> {
        val raw = text.split(SPLIT_REGEX) + text.split(CAMEL_REGEX)
        return raw
            .map { it.lowercase().trim() }
            .filter { it.length > 1 && it !in STOPWORDS }
            .toSet()
    }

    /** Remove stopwords from a list of query terms. */
    fun removeStopwords(terms: List<String>): List<String> =
        terms.filter { it.lowercase() !in STOPWORDS }
}
```

### 5.3 New Class: SemanticGrouper

**File:** `orchestration/registry/SemanticGrouper.kt`
**Lines:** ~100

```kotlin
package com.codeintel.orchestration.registry

import com.codeintel.log

/**
 * Builds fallback chains by grouping tools with similar functionality.
 * Two grouping strategies: exact name match + semantic description similarity.
 */
class SemanticGrouper(private val similarityThreshold: Double = 0.7) {

    /** Build all chains from a list of registered tools. */
    fun buildChains(tools: List<RegisteredTool>): Map<String, ToolChain> {
        val chains = mutableMapOf<String, ToolChain>()
        buildExactNameChains(tools, chains)
        buildSemanticChains(tools, chains)
        return chains
    }

    /** Group tools with identical names on different servers. */
    private fun buildExactNameChains(
        tools: List<RegisteredTool>,
        chains: MutableMap<String, ToolChain>
    ) {
        val grouped = tools.groupBy { it.name }
        for ((name, group) in grouped) {
            if (group.size < 2) continue
            val entries = group
                .map { ChainEntry(it.source.removePrefix("child:"), it.priority, it.name) }
                .sortedBy { it.priority }
            chains[name] = ToolChain(name, entries, "exact_name", emptySet())
        }
    }

    /** Group tools with similar descriptions (different names). */
    private fun buildSemanticChains(
        tools: List<RegisteredTool>,
        chains: MutableMap<String, ToolChain>
    ) {
        val ungrouped = tools.filter { it.name !in chains }
        val paired = mutableSetOf<String>()

        for (i in ungrouped.indices) {
            if (ungrouped[i].name in paired) continue
            for (j in i + 1 until ungrouped.size) {
                if (ungrouped[j].name in paired) continue
                val sim = computeSimilarity(ungrouped[i], ungrouped[j])
                if (sim >= similarityThreshold) {
                    mergeIntoChain(ungrouped[i], ungrouped[j], sim, chains)
                    paired.add(ungrouped[i].name)
                    paired.add(ungrouped[j].name)
                }
            }
        }
    }

    /** Weighted Jaccard similarity between two tools. */
    fun computeSimilarity(a: RegisteredTool, b: RegisteredTool): Double {
        val tokensA = a.nameTokens + a.descTokens
        val tokensB = b.nameTokens + b.descTokens
        if (tokensA.isEmpty() || tokensB.isEmpty()) return 0.0

        val intersection = tokensA.intersect(tokensB)
        val union = tokensA.union(tokensB)
        val jaccard = intersection.size.toDouble() / union.size.toDouble()

        // Bonus for name token overlap
        val nameOverlap = a.nameTokens.intersect(b.nameTokens).size
        val bonus = nameOverlap * 0.1

        return minOf(1.0, jaccard + bonus)
    }

    private fun mergeIntoChain(
        a: RegisteredTool, b: RegisteredTool,
        similarity: Double, chains: MutableMap<String, ToolChain>
    ) {
        val canonical = if (a.priority <= b.priority) a else b
        val other = if (a.priority <= b.priority) b else a
        val entries = listOf(
            ChainEntry(canonical.source.removePrefix("child:"), canonical.priority, canonical.name),
            ChainEntry(other.source.removePrefix("child:"), other.priority, other.name)
        ).sortedBy { it.priority }

        val reason = "semantic_similarity:${"%.2f".format(similarity)}"
        chains[canonical.name] = ToolChain(
            canonical.name, entries, reason, setOf(other.name)
        )
        // Also map the alternative name to this chain
        chains[other.name] = chains[canonical.name]!!
        log("[SemanticGrouper] Grouped '${canonical.name}' + '${other.name}' (sim=${"%.2f".format(similarity)})")
    }
}
```

### 5.4 Modified Class: UnifiedRegistry

**Key changes:**
1. Pre-compute `nameTokens` and `descTokens` when registering tools
2. Replace `rebuildChains()` with delegation to `SemanticGrouper`
3. Replace `search()` with tokenized scoring

```kotlin
// Key method changes in UnifiedRegistry:

/** Tokenized search — replaces old contains() search. */
fun search(query: String): List<RegisteredTool> {
    val terms = Tokenizer.tokenize(query)
    if (terms.isEmpty()) return merged.filter { isEnabled(it.name) }
    
    return merged
        .filter { isEnabled(it.name) }
        .map { tool -> tool to scoreAgainstTerms(tool, terms) }
        .filter { it.second > 0.0 }
        .sortedByDescending { it.second }
        .map { it.first }
}

private fun scoreAgainstTerms(tool: RegisteredTool, queryTerms: Set<String>): Double {
    var score = 0.0
    for (term in queryTerms) {
        when {
            term in tool.nameTokens -> score += 2.0
            tool.descTokens.any { it.contains(term) } -> score += 1.0
        }
    }
    return if (queryTerms.isNotEmpty()) score / (queryTerms.size * 2.0) else 0.0
}

/** Delegate chain building to SemanticGrouper. */
private fun rebuildChains() {
    val grouper = SemanticGrouper(similarityThreshold)
    val newChains = grouper.buildChains(childTools)
    chains.clear()
    chains.putAll(newChains)
}
```

### 5.5 Modified Class: FindToolsTool

**Key changes:**
1. Add KB search alongside registry search
2. Merge and deduplicate results

```kotlin
// Key method change in FindToolsTool:

fun execute(args: JsonObject): String {
    val query = args["query"]?.jsonPrimitive?.content
        ?: return errorJson("Missing 'query'")
    
    // Search registry (primary)
    val registryResults = engine.getRegistry().search(query)
    
    // Search KB (secondary, best-effort)
    val kbResults = searchKb(query)
    
    // Merge and deduplicate
    val merged = mergeResults(registryResults, kbResults)
    
    val arr = buildJsonArray {
        for (tool in merged.take(10)) { add(tool.definition) }
    }
    return json.encodeToString(JsonArray.serializer(), arr)
}

private fun searchKb(query: String): List<RegisteredTool> {
    val mem = engine.getMemoryEngine() ?: return emptyList()
    return try {
        // Search with 2s timeout
        val results = mem.search(query, tags = "tools,registry", limit = 20)
        parseKbResults(results)
    } catch (e: Exception) {
        log("[find_tools] KB search failed: ${e.message}")
        emptyList()
    }
}
```

### 5.6 Modified Class: OrchestrationEngine

**Key changes:**
1. Add recursive discovery in `buildRoutingTable()`
2. Expose `getMemoryEngine()` for FindToolsTool

```kotlin
// Key additions to OrchestrationEngine:

/** Expose memory engine for KB search in find_tools. */
fun getMemoryEngine(): MemoryEngine? = memoryEngine

/** Recursive discovery — detect nested orchestrators. */
private suspend fun discoverRecursive(
    serverName: String, configIndex: Int, depth: Int, visited: MutableSet<String>
): List<Pair<String, JsonObject>> {
    if (depth > config.settings.maxRecursionDepth) return emptyList()
    if (serverName in visited) return emptyList()
    visited.add(serverName)
    
    val directTools = serverManager.getToolsForServer(serverName)
    val toolNames = directTools.map { it["name"]?.jsonPrimitive?.content ?: "" }
    val isNested = "find_tools" in toolNames || "execute_dynamic_tool" in toolNames
    
    if (!isNested) return directTools.map { serverName to it }
    
    // Recursively discover nested tools
    val nestedTools = discoverNestedTools(serverName, configIndex, depth, visited)
    return directTools.map { serverName to it } + nestedTools
}

private suspend fun discoverNestedTools(
    serverName: String, configIndex: Int, depth: Int, visited: MutableSet<String>
): List<Pair<String, JsonObject>> {
    return try {
        val response = serverManager.callTool(
            serverName, "find_tools",
            buildJsonObject { put("query", "") },
            config.settings.discoveryTimeoutMs
        )
        parseNestedToolResponse(response, serverName, depth)
    } catch (e: Exception) {
        log("Nested discovery failed for $serverName: ${e.message}")
        emptyList()
    }
}
```


---

## 6. Integration Design

### 6.1 Integration: Child MCP Servers (via stdio JSON-RPC)

| Attribute | Value |
|-----------|-------|
| Protocol | JSON-RPC 2.0 over stdio (stdin/stdout) |
| Endpoint | Child process stdin/stdout pipes |
| Authentication | None (local process) |
| Timeout | Per-server configurable (default 30s) |
| Retry Policy | No retry on single call; fallback chain handles retries across servers |
| Circuit Breaker | Not implemented (server state tracked by LocalServerManager) |

**Discovery Sequence:**

1. `OrchestrationEngine.start()` → `LocalServerManager.startAll()`
2. For each server: send `{"jsonrpc":"2.0","id":1,"method":"initialize",...}`
3. After init: send `{"jsonrpc":"2.0","id":2,"method":"tools/list"}`
4. Parse response → register tools
5. If nested: send `{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"find_tools","arguments":{"query":""}}}`

### 6.2 Integration: Memory Engine (KB)

| Attribute | Value |
|-----------|-------|
| Protocol | Internal Kotlin method calls |
| Endpoint | `MemoryEngine.knowledge.insert()` / `MemoryEngine.search()` |
| Authentication | None (same process) |
| Timeout | 2000ms for search (configurable) |
| Retry Policy | No retry; graceful degradation if unavailable |

**Ingest format:** Single entry with all tool definitions concatenated (existing behavior preserved).

**Search query:** Same query string as find_tools input, searched against KB entries tagged "tools,registry".

---

## 7. Security Design

### 7.1 Authentication

No authentication changes. MCP protocol is local (stdio) — no network exposure.

### 7.2 Data Protection

| Data Type | At Rest | In Transit | In Logs |
|-----------|---------|------------|---------|
| Tool definitions | Plain (KB SQLite) | N/A (local) | Full (not sensitive) |
| Tool arguments | Not stored | stdio pipe | Truncated (may contain user data) |
| Server config | Plain (JSON file) | N/A (local) | Excluded (may have paths) |

### 7.3 Input Validation

| Field | Validation | Sanitization |
|-------|-----------|--------------|
| find_tools.query | Non-null string | Trim whitespace, lowercase for matching |
| execute_dynamic_tool.tool_name | Non-null, non-empty string | None (exact match required) |
| execute_dynamic_tool.arguments | Valid JsonObject or null | Default to empty `{}` if null |
| similarityThreshold (config) | 0.0 ≤ value ≤ 1.0 | Clamp to range |
| maxRecursionDepth (config) | 1 ≤ value ≤ 5 | Clamp to range |

---

## 8. Performance & Scalability

### 8.1 Performance Targets

| Operation | Target | Current | Improvement Strategy |
|-----------|--------|---------|---------------------|
| find_tools (500 tools) | < 200ms | ~50ms (substring) | Pre-computed tokens → O(n) scan with set lookups |
| Startup discovery (10 servers) | < 15s | ~5s (direct only) | Parallel discovery with per-server timeout |
| Fallback hop overhead | < 100ms | ~50ms | Already fast; connection-refused = instant skip |
| Semantic grouping (500 tools) | < 5s (one-time at startup) | N/A (new) | O(n²) pairwise but n ≤ 500, one-time cost |
| KB search | < 2000ms | ~100ms | Already fast; timeout as safety net |

### 8.2 Scalability Considerations

| Concern | Limit | Mitigation |
|---------|-------|------------|
| Pairwise similarity (O(n²)) | 500 tools → 125K comparisons | One-time at startup; < 5s for string operations |
| Registry memory | 500 tools × ~2KB each = ~1MB | Negligible |
| Chain lookup | O(1) HashMap | No concern |
| KB entries | 1 entry per startup (concatenated) | Minimal storage |

### 8.3 Caching Strategy

| Cache | What | TTL | Eviction |
|-------|------|-----|----------|
| RegisteredTool.nameTokens | Pre-computed token sets | Until rebuild | Rebuilt on config reload |
| RegisteredTool.descTokens | Pre-computed token sets | Until rebuild | Rebuilt on config reload |
| chains map | Computed fallback chains | Until rebuild | Rebuilt on config reload |

---

## 9. Monitoring & Observability

### 9.1 Logging

| Log Event | Level | Fields | Destination |
|-----------|-------|--------|-------------|
| Semantic grouping result | INFO | tool names, similarity score | stderr |
| Nested orchestrator detected | INFO | server name, depth | stderr |
| Nested discovery failed | WARN | server name, error message | stderr |
| KB search failed | WARN | error message | stderr |
| Chain execution fallback | INFO | tool name, failed server, next server | stderr |
| All servers in chain failed | ERROR | tool name, all server errors | stderr |
| Discovery timeout | WARN | server name, elapsed time | stderr |

### 9.2 Metrics (via ToolMetrics in SmartRouter)

| Metric | Type | Description |
|--------|------|-------------|
| callCount | Counter | Total calls per tool |
| errorCount | Counter | Failed calls per tool |
| totalLatencyMs | Counter | Cumulative latency per tool |
| lastCallAt | Gauge | Timestamp of last call |

---

## 10. Deployment Considerations

### 10.1 Configuration Changes

New fields in `orchestration.json` → `settings` section:

```json
{
  "mcpServers": { ... },
  "settings": {
    "autoLog": true,
    "similarityThreshold": 0.7,
    "maxRecursionDepth": 3,
    "discoveryTimeoutMs": 10000,
    "kbSearchTimeoutMs": 2000
  }
}
```

All new fields have defaults — existing configs work without modification (backward compatible).

### 10.2 Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| settings.similarityThreshold | 0.7 | Set to 1.0 to disable semantic grouping (only exact name) |
| settings.maxRecursionDepth | 3 | Set to 0 to disable nested discovery |
| settings.kbSearchTimeoutMs | 2000 | Set to 0 to disable KB search in find_tools |

### 10.3 Rollback Strategy

1. Revert code changes (git revert)
2. No config migration needed (new fields are optional with defaults)
3. No data migration needed (KB entries are overwritten each startup)
4. Existing chains (exact-name only) continue to work if semantic grouping is disabled

---

## 11. Implementation Checklist

### Files to Create

| # | File | Package | Lines (est.) | Purpose |
|---|------|---------|-------------|---------|
| 1 | `Tokenizer.kt` | `orchestration.registry` | ~60 | Text tokenization utility |
| 2 | `SemanticGrouper.kt` | `orchestration.registry` | ~100 | Similarity computation + chain building |

### Files to Modify

| # | File | Changes | Lines Added/Removed |
|---|------|---------|---------------------|
| 1 | `UnifiedRegistry.kt` | Add token fields to RegisteredTool, replace search(), delegate rebuildChains() | +30 / -20 |
| 2 | `FindToolsTool.kt` | Add KB search, merge results | +25 / -5 |
| 3 | `OrchestrationEngine.kt` | Add recursive discovery, expose memoryEngine | +40 / -5 |
| 4 | `ExecuteDynamicTool.kt` | Support ChainEntry.toolName in executeChain() | +5 / -2 |
| 5 | `OrchestrationConfig.kt` | Add new settings fields with defaults | +5 / -0 |

### Implementation Order

1. `Tokenizer.kt` — no dependencies, pure utility
2. `SemanticGrouper.kt` — depends on Tokenizer + RegisteredTool
3. `UnifiedRegistry.kt` — integrate Tokenizer + SemanticGrouper
4. `FindToolsTool.kt` — integrate KB search
5. `OrchestrationEngine.kt` — recursive discovery + expose memoryEngine
6. `ExecuteDynamicTool.kt` — minor enhancement for server-specific names
7. `OrchestrationConfig.kt` — add new settings fields

---

## 12. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture Overview | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
| 3 | Class Diagram | [class-diagram.png](diagrams/class-diagram.png) | [class-diagram.drawio](diagrams/class-diagram.drawio) |

### Open Questions

| # | Question | Status | Answer |
|---|----------|--------|--------|
| 1 | Should semantic grouping use vector embeddings instead of Jaccard? | Resolved | No — Jaccard is sufficient for tool descriptions (short text), avoids external dependency |
| 2 | Should chains persist across restarts (in KB)? | Resolved | No — chains are rebuilt each startup from live server state |
| 3 | How to handle tool name conflicts between semantic chains? | Resolved | Canonical name = highest-priority tool's name; alternative names also map to same chain |
