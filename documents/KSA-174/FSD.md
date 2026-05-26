# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-174: [Kotlin] AI Context Tools

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-174 |
| Title | [Kotlin] AI Context Tools — Port AI context tools from Node.js to Kotlin |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-05-25 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-174.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-25 | BA Agent | Initial document |
| 1.0 | 2026-05-25 | TA Agent | Technical enrichment — API contracts, pseudocode |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the AI Context Tools module for the Kotlin MCP Code Intelligence server. It defines three MCP tools (`get_ai_context`, `get_edit_context`, `get_curated_context`) that provide intelligent code context retrieval for AI agents.

### 1.2 Scope

Port the complete AI Context module from Node.js to Kotlin, maintaining functional parity with the reference implementation while leveraging Kotlin idioms (coroutines, sealed classes, extension functions).

### 1.3 Definitions and Acronyms

| Term | Definition |
|------|------------|
| MCP | Model Context Protocol |
| RRF | Reciprocal Rank Fusion — merging algorithm for ranked lists |
| FTS5 | SQLite Full-Text Search extension |
| Token | ~4 characters of text (LLM context unit) |
| Intent | Purpose of context request: explain, modify, debug, test |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | documents/KSA-174/BRD.md |
| Node.js Source | mcp-code-intelligence-nodejs/src/context/ |
| Graph Engine (K2) | KSA-173 |
| Tree-sitter (K1) | KSA-172 |

---

## 2. System Overview

### 2.1 System Context

The AI Context Tools module sits between the MCP protocol layer and the indexed code database. AI agents call MCP tools, which delegate to context services that query the symbol database, call graph, and knowledge base.

### 2.2 Module Dependencies

| Module | Provided By | Used For |
|--------|-------------|----------|
| SymbolResolver | KSA-173 | Resolve symbol names to DB records |
| CallGraphService | KSA-173 | Traverse callers/callees |
| TestDetector | KSA-173 | Find related test functions |
| GraphTraverser | KSA-173 | Graph expansion for curated context |
| DatabaseManager | KSA-172 | SQLite connection management |
| QueryLayer | KSA-173 | FTS5 code search |

---

## 3. Functional Requirements

### 3.1 Feature: Intent-Aware Context (get_ai_context)

**Source:** BRD Story 1

#### 3.1.1 Description

Provides code context tailored to the AI agent's current intent. Different intents prioritize different context sections.

#### 3.1.2 Use Case

**Use Case ID:** UC-01
**Actor:** AI Agent
**Preconditions:** Codebase is indexed; symbol exists in database
**Postconditions:** Agent receives structured context within token budget

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls get_ai_context | | Provides symbol name and intent |
| 2 | | Resolves symbol | SymbolResolver finds symbol in DB |
| 3 | | Selects strategy | IntentStrategy maps intent to section priorities |
| 4 | | Fetches sections | Each section fetched from DB/graph/filesystem |
| 5 | | Assembles budget | TokenBudgetManager fits sections within budget |
| 6 | | Returns response | Structured JSON with sections + metadata |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Symbol has multiple matches | Return best match (exact > partial > fuzzy) |
| AF-02 | Some sections empty | Skip empty sections, allocate budget to remaining |
| AF-03 | Budget too small for all sections | Include only highest-priority sections |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Symbol not found | Return not_found response with suggestions |
| EF-02 | Database error | Return error response with message |
| EF-03 | Git unavailable | Skip git section, continue with remaining |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-01 | Token budget minimum is 500 tokens | BRD NFR |
| BR-02 | Token budget maximum is 32000 tokens | System limit |
| BR-03 | Caller depth maximum is 5 | Performance constraint |
| BR-04 | Intent defaults to "explain" if not specified | BRD Story 1 |
| BR-05 | Sections are assembled in priority order (lower number = higher priority) | BRD Story 1 |

#### 3.1.4 Data Specifications

**Input Data:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| symbol | string | Yes | Non-empty, max 200 chars | Symbol name to resolve |
| intent | enum | No | explain/modify/debug/test | Context intent (default: explain) |
| token_budget | integer | No | 500-32000 | Max tokens (default: 4000) |
| caller_depth | integer | No | 1-5 | Traversal depth (default: 1) |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| symbol | object | Resolved symbol info (name, file, line, kind) |
| intent | string | The intent used |
| sections | object | Map of section_name → content |
| metadata.tokens_used | integer | Total tokens consumed |
| metadata.tokens_budget | integer | Budget specified |
| metadata.sections_included | string[] | Sections that fit in budget |
| metadata.sections_excluded | string[] | Sections that didn't fit |
| metadata.execution_time_ms | integer | Processing time |

#### 3.1.5 API Contract

**Tool:** `get_ai_context`
**Protocol:** MCP (JSON-RPC over stdio)

**Request:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_ai_context",
    "arguments": {
      "symbol": "AIContextService.getContext",
      "intent": "modify",
      "token_budget": 4000,
      "caller_depth": 2
    }
  }
}
```

**Response:**
```json
{
  "symbol": { "name": "getContext", "file": "src/context/ai-context-service.ts", "line": 37, "kind": "method" },
  "intent": "modify",
  "sections": {
    "source": "async getContext(params: AIContextParams)...",
    "callers": [{ "name": "handleGetAIContext", "file": "src/tools/ai-context-tools.ts", "line": 65 }],
    "callees": [{ "name": "fetchSection", "file": "src/context/ai-context-service.ts", "line": 103 }],
    "tests": [{ "name": "test getContext returns explain sections", "file": "tests/ai-context.test.ts" }]
  },
  "metadata": {
    "tokens_used": 2847,
    "tokens_budget": 4000,
    "sections_included": ["source", "callers", "callees", "tests"],
    "sections_excluded": ["imports", "type_definitions", "siblings"],
    "execution_time_ms": 45
  }
}
```

**Error Response:**
```json
{
  "symbol": null,
  "intent": "modify",
  "sections": {},
  "metadata": { "tokens_used": 50, "tokens_budget": 4000, "error": "Symbol 'xyz' not found" }
}
```

---

### 3.2 Feature: Edit Context (get_edit_context)

**Source:** BRD Story 2

#### 3.2.1 Description

Provides everything an AI agent needs before editing a symbol: source code, callers that may break, related tests to update, git history for context, and sibling functions for consistency.

#### 3.2.2 Use Case

**Use Case ID:** UC-02
**Actor:** AI Agent
**Preconditions:** Codebase indexed; symbol exists
**Postconditions:** Agent has full edit context

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls get_edit_context | | Provides symbol + options |
| 2 | | Resolves symbol | Supports name, Class.method, file:line |
| 3 | | Reads source | Full source code of the symbol |
| 4 | | Fetches callers | Functions that call this symbol |
| 5 | | Fetches tests | Test functions that test this symbol |
| 6 | | Fetches git | Recent commits touching this file |
| 7 | | Fetches siblings | Other functions in same file/class |
| 8 | | Assembles within budget | Priority: source > callers > tests > git > siblings |
| 9 | | Returns response | Structured result |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | include_callers=false | Skip caller fetching |
| AF-02 | include_tests=false | Skip test fetching |
| AF-03 | include_git=false | Skip git history |
| AF-04 | file:line format | Resolve symbol at specific line in file |

#### 3.2.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-06 | Source section is always included (cannot be disabled) | Design decision |
| BR-07 | Git history limited to last 10 commits | Performance |
| BR-08 | Callers show signature + file:line (not full source) | Budget efficiency |
| BR-09 | Tests show full test function source | Needed for modification |

#### 3.2.4 API Contract

**Tool:** `get_edit_context`

**Request:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_edit_context",
    "arguments": {
      "symbol": "TokenBudgetManager.assemble",
      "include_callers": true,
      "include_tests": true,
      "include_git": true,
      "token_budget": 6000,
      "caller_depth": 1
    }
  }
}
```

**Response:**
```json
{
  "symbol": { "name": "assemble", "file": "src/context/token-budget-manager.ts", "line": 82, "kind": "method", "signature": "assemble(sections, budget)" },
  "source": "assemble(\n  sections: Record<string, ...>...",
  "callers": [
    { "name": "getContext", "file": "src/context/ai-context-service.ts", "line": 95, "signature": "async getContext(params)" }
  ],
  "tests": [
    { "name": "test assemble respects budget", "file": "tests/budget.test.ts", "source": "it('respects budget', () => {...})" }
  ],
  "git": [
    { "hash": "a1b2c3d", "author": "dev", "date": "2026-05-20", "message": "fix budget overflow" }
  ],
  "siblings": [
    { "name": "estimateTokens", "kind": "method", "line": 18, "signature": "estimateTokens(content)" },
    { "name": "canFit", "kind": "method", "line": 24, "signature": "canFit(tokens)" }
  ],
  "metadata": { "tokens_used": 4200, "tokens_budget": 6000, "execution_time_ms": 78 }
}
```

---

### 3.3 Feature: Curated Context (get_curated_context)

**Source:** BRD Story 3

#### 3.3.1 Description

Natural language query across the entire codebase. Searches code symbols (FTS5), knowledge base (memory), and graph relationships, then merges results using Reciprocal Rank Fusion (RRF) within a token budget.

#### 3.3.2 Use Case

**Use Case ID:** UC-03
**Actor:** AI Agent
**Preconditions:** Codebase indexed; FTS5 tables populated
**Postconditions:** Agent receives ranked, budgeted results from multiple sources

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls get_curated_context | | Provides NL query |
| 2 | | Analyzes query | Extract keywords, FTS query, symbol candidates |
| 3 | | Searches code | FTS5 search + direct symbol resolution |
| 4 | | Searches memory | Knowledge base FTS search |
| 5 | | Expands graph | For top code results, find related via graph |
| 6 | | Merges with RRF | Combine all sources with weighted RRF |
| 7 | | Allocates budget | Fit merged results within token budget |
| 8 | | Returns response | Sections grouped by source |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | include_source=false | Skip code search |
| AF-02 | include_memory=false | Skip KB search |
| AF-03 | include_graph=false | Skip graph expansion |
| AF-04 | Custom source_weights | Apply weights to RRF scoring |

#### 3.3.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-10 | RRF constant k=60 | Standard RRF parameter |
| BR-11 | Default weights: code=1.0, memory=0.8, graph=0.6 | Tuned defaults |
| BR-12 | Graph expansion limited to top 5 code results | Performance |
| BR-13 | Graph traversal depth = 1 for expansion | Performance |
| BR-14 | Deduplication by symbol name + file path | Avoid redundancy |

#### 3.3.4 API Contract

**Tool:** `get_curated_context`

**Request:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_curated_context",
    "arguments": {
      "query": "how does token budget management work",
      "max_tokens": 4000,
      "include_source": true,
      "include_memory": true,
      "include_graph": true,
      "source_weights": { "code": 1.0, "memory": 0.8, "graph": 0.6 }
    }
  }
}
```

**Response:**
```json
{
  "query": "how does token budget management work",
  "sections": [
    {
      "title": "Code Symbols",
      "source": "code",
      "items": [
        { "name": "TokenBudgetManager", "kind": "class", "file": "src/context/token-budget-manager.ts", "line": 6, "relevance": 0.95 },
        { "name": "BudgetAllocator", "kind": "class", "file": "src/context/budget-allocator.ts", "line": 8, "relevance": 0.87 }
      ]
    },
    {
      "title": "Knowledge Base",
      "source": "memory",
      "items": [
        { "name": "Token budgeting design decision", "kind": "DECISION", "relevance": 0.72, "content": "We use ~4 chars/token..." }
      ]
    },
    {
      "title": "Related (Graph)",
      "source": "graph",
      "items": [
        { "name": "AIContextService", "kind": "class", "file": "src/context/ai-context-service.ts", "relevance": 0.65, "relationship": "calls TokenBudgetManager" }
      ]
    }
  ],
  "metadata": {
    "tokens_used": 3200,
    "tokens_budget": 4000,
    "sources_queried": ["code", "memory", "graph"],
    "total_candidates": 45,
    "results_returned": 12,
    "execution_time_ms": 230
  }
}
```

---

## 4. Data Model

### 4.1 Logical Entities

#### Entity: ResolvedSymbol

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| id | integer | Yes | Database row ID |
| name | string | Yes | Symbol name |
| kind | enum | Yes | function, method, class, interface, variable |
| filePath | string | Yes | Relative file path |
| startLine | integer | Yes | Start line number |
| endLine | integer | No | End line number |
| signature | string | No | Function/method signature |
| parentName | string | No | Parent class name (for methods) |

#### Entity: IntentStrategy

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| intent | enum | Yes | explain, modify, debug, test |
| sections | SectionDef[] | Yes | Ordered list of sections with priorities |

#### Entity: SectionDef

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Section identifier (source, callers, tests, etc.) |
| priority | integer | Yes | Lower = higher priority (1 = highest) |
| format | enum | Yes | full, summary, signatures |

#### Entity: ContextResponse

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | ResolvedSymbol | No | Resolved symbol (null if not found) |
| sections | Map | Yes | section_name → content |
| metadata | ResponseMetadata | Yes | Budget usage, timing, included/excluded |

#### Entity: MergedResult (for Curated Context)

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Result name |
| kind | string | Yes | Result type |
| file | string | No | File path (for code results) |
| line | integer | No | Line number |
| content | string | No | Content preview |
| sources | string[] | Yes | Which sources found this result |
| rrf_score | float | Yes | Combined RRF score |
| relevance_score | float | Yes | Normalized relevance (0-1) |

---

## 5. Processing Logic

### 5.1 Intent Strategy Selection

**Trigger:** get_ai_context called with intent parameter

**Pseudocode:**
```
function getStrategy(intent: String): IntentStrategy {
    return when (intent) {
        "explain" -> EXPLAIN_STRATEGY  // source(1) → doc(2) → siblings(3) → imports(4) → callers(5) → callees(6) → types(7)
        "modify"  -> MODIFY_STRATEGY   // source(1) → callers(2) → callees(3) → tests(4) → imports(5) → types(6) → siblings(7)
        "debug"   -> DEBUG_STRATEGY    // source(1) → callers(2) → errors(3) → changes(4) → imports(5) → siblings(6) → callees(7)
        "test"    -> TEST_STRATEGY     // source(1) → tests(2) → patterns(3) → callees(4) → types(5) → mocks(6) → siblings(7)
        else      -> EXPLAIN_STRATEGY  // default
    }
}
```

### 5.2 Token Budget Assembly

**Trigger:** All sections fetched, need to fit within budget

**Pseudocode:**
```
function assemble(sections: Map<String, SectionContent>, budget: Int): AssemblyResult {
    val sorted = sections.entries.sortedBy { it.value.priority }
    val result = mutableMapOf<String, Any>()
    var usedTokens = 0
    val included = mutableListOf<String>()
    val excluded = mutableListOf<String>()

    for ((key, section) in sorted) {
        val tokens = estimateTokens(section.content)  // content.length / 4
        if (usedTokens + tokens <= budget) {
            result[key] = section.content
            usedTokens += tokens
            included.add(key)
        } else if (section.content is List<*> && section.content.isNotEmpty()) {
            // Try partial inclusion for arrays
            val truncated = truncateArray(section.content, budget - usedTokens)
            if (truncated.isNotEmpty()) {
                result[key] = truncated
                usedTokens += estimateTokens(truncated)
                included.add("$key (truncated)")
            } else {
                excluded.add(key)
            }
        } else {
            excluded.add(key)
        }
    }
    return AssemblyResult(result, usedTokens, included, excluded)
}
```

### 5.3 RRF Merge Algorithm

**Trigger:** get_curated_context after parallel search completes

**Pseudocode:**
```
function merge(sources: Map<String, SearchResults>, weights: SourceWeights): List<MergedResult> {
    val k = 60  // RRF constant
    val scores = mutableMapOf<String, MergedScore>()  // key = name:file

    for ((sourceName, results) in sources) {
        val weight = weights.getWeight(sourceName)  // code=1.0, memory=0.8, graph=0.6
        for ((rank, item) in results.withIndex()) {
            val key = "${item.name}:${item.file ?: ""}"
            val existing = scores.getOrPut(key) { MergedScore(item) }
            existing.score += weight * (1.0 / (k + rank))
            existing.sources.add(sourceName)
        }
    }

    return scores.values
        .sortedByDescending { it.score }
        .map { it.toMergedResult() }
}
```

### 5.4 Query Analysis (for Curated Context)

**Trigger:** get_curated_context receives NL query

**Processing:**
1. Tokenize query into words
2. Remove stop words (the, a, an, is, are, how, does, what)
3. Extract potential symbol names (CamelCase, snake_case patterns)
4. Build FTS5 query from remaining keywords (OR-joined)
5. Return: { ftsQuery, keywords, symbolCandidates }

### 5.5 Symbol Resolution

**Trigger:** Any tool receives a symbol parameter

**Processing:**
1. Check format:
   - Contains `.` → split into `className.methodName`, search methods within class
   - Contains `:` → split into `file:symbolName`, search symbols in specific file
   - Otherwise → search all symbols by name
2. Query symbols table with appropriate filter
3. If multiple results: prefer exact name match > starts-with > contains
4. Return first match or null

---

## 6. Integration Specifications

### 6.1 External System: Git CLI

| Attribute | Value |
|-----------|-------|
| Purpose | Retrieve recent commit history for edit context |
| Direction | Outbound (read-only) |
| Data Format | Text (git log output) |
| Frequency | On-demand (when include_git=true) |

**Command:** `git log --oneline -10 -- {filePath}`

**Graceful Degradation:** If git not available or not a git repo, return empty git section (no error).

### 6.2 External System: SQLite Database

| Attribute | Value |
|-----------|-------|
| Purpose | Symbol storage, call graph, FTS5 search |
| Direction | Read-only (context tools don't write) |
| Data Format | SQL queries |
| Frequency | Every tool call |

**Key Tables:**
- `symbols` — indexed code symbols
- `call_graph_edges` — caller/callee relationships
- `symbols_fts` — FTS5 virtual table for text search
- `knowledge_entries` — KB entries (for curated context)
- `knowledge_fts` — FTS5 for KB search

---

## 7. Security Requirements

### 7.1 Data Access

| Concern | Requirement |
|---------|-------------|
| File system | Read-only access to source files within workspace |
| Database | Read-only access to indexed data |
| Git | Read-only git log (no write operations) |
| Network | No network access required |

### 7.2 Input Validation

| Input | Validation | Reason |
|-------|-----------|--------|
| symbol | Max 200 chars, no path traversal (../) | Prevent file system abuse |
| token_budget | 500-32000 range | Prevent resource exhaustion |
| caller_depth | 1-5 range | Prevent exponential graph traversal |
| query | Max 500 chars | Prevent FTS5 abuse |

---

## 8. Non-Functional Requirements

| Category | Requirement | Acceptance Criteria |
|----------|-------------|---------------------|
| Performance | get_ai_context < 500ms | P95 latency for typical symbols |
| Performance | get_edit_context < 500ms | Excluding git (git adds up to 200ms) |
| Performance | get_curated_context < 1000ms | Includes FTS + graph + RRF |
| Performance | Symbol resolution < 50ms | Database indexed lookup |
| Reliability | Graceful degradation | Missing sections don't crash; return partial results |
| Compatibility | Output parity | Same JSON structure as Node.js implementation |
| Memory | Budget manager < 1MB overhead | Token counting is lightweight |

---

## 9. Error Handling

### 9.1 Error Scenarios

| Scenario | Severity | Response | Recovery |
|----------|----------|----------|----------|
| Symbol not found | Info | Return not_found with suggestions | Agent can retry with different name |
| Database connection lost | Critical | Return error response | Reconnect on next call |
| Git not available | Warning | Skip git section | Continue without git |
| FTS5 query syntax error | Warning | Return empty code results | Log error, continue |
| Token budget too small | Info | Return only source section | Agent can increase budget |
| Caller depth exceeds max | Info | Clamp to max (5) | Proceed with clamped value |

---

## 10. Testing Considerations

### 10.1 Key Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-01 | Basic explain intent | symbol="TokenBudgetManager", intent="explain" | Source + doc + siblings | High |
| TC-02 | Modify intent includes callers | symbol="assemble", intent="modify" | Source + callers + tests | High |
| TC-03 | Budget overflow truncation | budget=500, large symbol | Only source section | High |
| TC-04 | Symbol not found | symbol="nonexistent" | Not found response | High |
| TC-05 | Edit context with all options | symbol + all flags true | Source + callers + tests + git + siblings | High |
| TC-06 | Edit context git disabled | include_git=false | No git section | Medium |
| TC-07 | Curated context NL query | query="authentication" | Ranked results from code + memory | High |
| TC-08 | RRF merge correctness | 3 source lists | Correctly merged by RRF score | High |
| TC-09 | Custom weights affect ranking | weights={code:0.5, memory:1.5} | Memory results ranked higher | Medium |
| TC-10 | Class.method resolution | symbol="AIContextService.getContext" | Resolves to method in class | High |
| TC-11 | file:symbol resolution | symbol="src/context/types.ts:CuratedContextParams" | Resolves to type in file | Medium |
| TC-12 | Partial array truncation | Large callers list, small budget | Partial callers included | Medium |

---

## 11. Appendix

### Intent Strategy Matrix

| Section | explain | modify | debug | test |
|---------|---------|--------|-------|------|
| source | 1 | 1 | 1 | 1 |
| doc_comment | 2 | - | - | - |
| callers | 5 | 2 | 2 | - |
| callees | 6 | 3 | 7 | 4 |
| tests | - | 4 | - | 2 |
| imports | 4 | 5 | 5 | - |
| siblings | 3 (sig) | 7 (sig) | 6 (sig) | 7 (sig) |
| type_definitions | 7 | 6 | - | 5 |
| error_patterns | - | - | 3 | - |
| recent_changes | - | - | 4 | - |
| test_patterns | - | - | - | 3 |
| mocks_needed | - | - | - | 6 |

*(Numbers = priority, lower = higher priority. "-" = not included. "sig" = signatures only)*

### File Structure (Kotlin)

```
mcp-code-intelligence-kotlin/src/main/kotlin/com/codeintel/
├── context/
│   ├── AIContextService.kt
│   ├── EditContextService.kt
│   ├── CuratedContextService.kt
│   ├── TokenBudgetManager.kt
│   ├── IntentStrategies.kt
│   ├── RRFMerger.kt
│   ├── BudgetAllocator.kt
│   ├── QueryAnalyzer.kt
│   ├── GitService.kt
│   └── Types.kt
└── tools/
    └── AIContextTools.kt
```
