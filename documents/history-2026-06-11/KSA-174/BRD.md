# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-174: [Kotlin] AI Context Tools

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-174 |
| Title | [Kotlin] AI Context Tools — Port AI context tools from Node.js to Kotlin |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-25 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-174.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-25 | BA Agent | Initial document — inferred from source code analysis of mcp-code-intelligence-nodejs/src/context/ and src/tools/ai-context-tools.ts |

---

## 1. Introduction

### 1.1 Scope

Port the AI Context Tools module from the Node.js MCP Code Intelligence server (`mcp-code-intelligence-nodejs/src/context/` and `src/tools/ai-context-tools.ts`) to the Kotlin implementation (`mcp-code-intelligence-kotlin`). This includes:

- **Intent-Aware Context Retrieval** (KSA-158 equivalent): `get_ai_context` — returns source, callers, callees, tests based on intent (explain/modify/debug/test) with token budgeting
- **Edit Context** (KSA-159 equivalent): `get_edit_context` — returns everything needed before editing a symbol (source + callers + tests + git history + siblings)
- **Curated Context** (KSA-160 equivalent): `get_curated_context` — natural language query across codebase with ranked results within token budget

The Kotlin implementation must expose the same MCP tool interfaces and produce equivalent output to the Node.js version.

### 1.2 Out of Scope

- Code Quality analysis tools (covered by KSA-175)
- Security analysis tools (covered by KSA-176)
- Similarity/duplicate detection (covered by KSA-177)
- Python track implementation (covered by KSA-180)
- Changes to the Node.js reference implementation
- UI/frontend changes (covered by KSA-170 epic)

### 1.3 Preliminary Requirements

- KSA-172 (Tree-sitter Core + Parsers for Kotlin) must be complete — provides AST parsing and symbol resolution
- KSA-173 (Graph Engine for Kotlin) must be complete — provides call graph traversal, symbol resolver, and test detector
- KSA-144 Batch 3 (Node.js AI Context implementation) must be complete — provides reference implementation
- Existing Kotlin project structure with `com.codeintel` package hierarchy

---

## 2. Business Requirements

### 2.1 High Level Process Map

The AI Context Tools module provides intelligent code context retrieval for AI agents:

1. **Symbol Resolution Phase**: Resolve user-provided symbol name to a concrete symbol in the indexed codebase (supports `Class.method`, `file:symbol`, and plain name formats)
2. **Intent Strategy Selection**: Based on the intent (explain/modify/debug/test), select which context sections to include and their priorities
3. **Context Fetching Phase**: Fetch relevant context sections (source code, callers, callees, tests, imports, siblings, git history, etc.)
4. **Token Budget Assembly**: Assemble sections within the token budget, prioritizing higher-priority sections and truncating lower-priority ones
5. **Response Formatting**: Return structured response with metadata (tokens used, sections included/excluded, timing)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source |
|---|------------------|----------|--------|
| 1 | As an AI agent, I want intent-aware code context so that I get the most relevant information for my current task (explain/modify/debug/test) | MUST HAVE | KSA-158 |
| 2 | As an AI agent, I want edit context before modifying code so that I understand callers, tests, and dependencies that may be affected | MUST HAVE | KSA-159 |
| 3 | As an AI agent, I want to query the codebase in natural language so that I can find relevant code, knowledge, and relationships | MUST HAVE | KSA-160 |
| 4 | As an AI agent, I want token budget management so that context fits within my context window limits | MUST HAVE | KSA-158 |
| 5 | As an AI agent, I want symbol resolution with fuzzy matching so that I can find symbols even with partial names | SHOULD HAVE | KSA-158 |
| 6 | As an AI agent, I want git history in edit context so that I understand recent changes to the code | SHOULD HAVE | KSA-159 |
| 7 | As an AI agent, I want RRF (Reciprocal Rank Fusion) merging in curated context so that results from multiple sources are well-ranked | SHOULD HAVE | KSA-160 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** AI agent calls one of the three MCP tools (`get_ai_context`, `get_edit_context`, or `get_curated_context`) with parameters

**Step 2:** Tool handler resolves the target symbol or parses the natural language query

**Step 3:** Intent strategy determines which context sections to fetch and their priority order

**Step 4:** Context fetcher retrieves each section from the indexed database (symbols, call graph, tests, git)

**Step 5:** Token Budget Manager assembles sections within the specified budget, truncating lower-priority sections if needed

**Step 6:** Formatted response is returned to the AI agent with metadata about what was included/excluded

---

#### STORY 1: Intent-Aware Code Context (`get_ai_context`)

> As an AI agent, I want intent-aware code context so that I get the most relevant information for my current task.

**Requirement Details:**

1. Accept a symbol name and intent (explain/modify/debug/test)
2. Resolve symbol using SymbolResolver (supports `Class.method`, `file:symbol`, plain name)
3. Select intent strategy that defines section priorities:
   - **explain**: source → doc_comment → siblings → imports → callers → callees → type_definitions
   - **modify**: source → callers → callees → tests → imports → type_definitions → siblings
   - **debug**: source → callers → error_patterns → recent_changes → imports → siblings → callees
   - **test**: source → tests → test_patterns → callees → type_definitions → mocks_needed → siblings
4. Fetch each section from the database/graph
5. Assemble within token budget (default 4000, min 500)
6. Return structured response with sections, metadata, and budget usage

**MCP Tool Interface:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | Yes | Symbol name (supports Class.method, file:symbol formats) |
| intent | string | No | Intent: explain, modify, debug, test (default: explain) |
| token_budget | number | No | Max tokens for response (default: 4000, min: 500) |
| caller_depth | number | No | Depth for caller/callee traversal (default: 1, max: 5) |

**Acceptance Criteria:**

1. Tool `get_ai_context` is registered and callable via MCP protocol
2. All 4 intents (explain/modify/debug/test) produce different section orderings
3. Token budget is respected — response never exceeds specified budget
4. Symbol resolution handles Class.method, file:symbol, and plain name formats
5. If symbol not found, returns helpful "not found" response with suggestions
6. Performance: response within 500ms for typical queries
7. Output format matches Node.js reference implementation

---

#### STORY 2: Edit Context (`get_edit_context`)

> As an AI agent, I want edit context before modifying code so that I understand the full impact of my changes.

**Requirement Details:**

1. Accept a symbol name with optional flags for what to include
2. Resolve symbol and fetch: source code, callers (who calls this?), related tests, git history, siblings
3. Each section is independently toggleable (include_callers, include_tests, include_git)
4. Token budget management with priority: source > callers > tests > git > siblings
5. Git history shows recent commits touching the symbol's file

**MCP Tool Interface:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| symbol | string | Yes | Symbol name or file:line format |
| include_callers | boolean | No | Include caller context (default: true) |
| include_tests | boolean | No | Include related test context (default: true) |
| include_git | boolean | No | Include git history (default: true) |
| token_budget | number | No | Max tokens (default: 4000) |
| caller_depth | number | No | Caller traversal depth (default: 1) |

**Acceptance Criteria:**

1. Tool `get_edit_context` is registered and callable via MCP protocol
2. Returns source code of the target symbol
3. Returns callers (functions that call this symbol) when include_callers=true
4. Returns related tests when include_tests=true
5. Returns git history (recent commits) when include_git=true
6. Token budget is respected
7. Each section can be independently disabled
8. Output format matches Node.js reference implementation

---

#### STORY 3: Curated Context (`get_curated_context`)

> As an AI agent, I want to query the codebase in natural language so that I can find relevant code and knowledge.

**Requirement Details:**

1. Accept a natural language query (e.g., "how does authentication work")
2. Search across three sources: code symbols (FTS), knowledge base (memory), graph relationships
3. Each source can be independently enabled/disabled
4. Use Reciprocal Rank Fusion (RRF) to merge results from multiple sources into a single ranked list
5. Support custom weights for source ranking (code, memory, graph)
6. Assemble results within token budget

**MCP Tool Interface:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | Natural language query |
| max_tokens | number | No | Max tokens for response (default: 4000) |
| include_source | boolean | No | Search code symbols (default: true) |
| include_memory | boolean | No | Search knowledge base (default: true) |
| include_graph | boolean | No | Expand via graph relationships (default: true) |
| source_weights | object | No | Custom weights: { code, memory, graph } |

**Acceptance Criteria:**

1. Tool `get_curated_context` is registered and callable via MCP protocol
2. Searches code symbols using FTS5 full-text search
3. Searches knowledge base entries
4. Expands results via graph relationships (callers/callees of found symbols)
5. RRF merger produces well-ranked combined results
6. Custom weights affect ranking order
7. Token budget is respected
8. Output format matches Node.js reference implementation

---

#### STORY 4: Token Budget Management

> As an AI agent, I want token budget management so that context fits within my context window limits.

**Requirement Details:**

1. Estimate token count using ~4 chars per token heuristic
2. Assemble sections by priority — higher priority sections get budget first
3. Truncate arrays (partial results) when full section doesn't fit
4. Report budget usage: tokens used, sections included, sections excluded
5. Minimum budget: 500 tokens
6. Support budget exhaustion detection (< 50 tokens remaining)

**Acceptance Criteria:**

1. Token estimation is consistent with Node.js implementation (~4 chars/token)
2. Higher priority sections are always included before lower priority ones
3. Arrays are partially included when full array doesn't fit
4. Budget metadata is included in every response
5. Minimum budget of 500 tokens is enforced

---

#### STORY 5: Symbol Resolution

> As an AI agent, I want symbol resolution with fuzzy matching so that I can find symbols even with partial names.

**Requirement Details:**

1. Support formats: `ClassName.methodName`, `file/path:symbolName`, plain `symbolName`
2. Resolve against indexed symbols database
3. Return resolved symbol with: name, file path, start line, end line, kind (function/class/method)
4. If multiple matches, prefer exact match over partial match
5. If no match, return null (caller handles "not found" response)

**Acceptance Criteria:**

1. `Class.method` format correctly resolves to the method within the class
2. `file:symbol` format correctly resolves to the symbol in the specified file
3. Plain name resolves to the best match in the codebase
4. Resolution is fast (< 50ms for typical queries)

---

#### STORY 6: Git History in Edit Context

> As an AI agent, I want git history in edit context so that I understand recent changes.

**Requirement Details:**

1. For a given file, retrieve recent git commits (last 10)
2. Show: commit hash (short), author, date, message
3. Optionally show diff for the specific symbol's lines
4. Integrate with edit context when include_git=true

**Acceptance Criteria:**

1. Git history shows recent commits for the symbol's file
2. Commits are sorted by date (newest first)
3. Each commit shows hash, author, date, message
4. Git operations don't block the main response if git is unavailable

---

#### STORY 7: RRF Merger for Curated Context

> As an AI agent, I want RRF merging so that results from multiple sources are well-ranked.

**Requirement Details:**

1. Implement Reciprocal Rank Fusion algorithm: `score = Σ 1/(k + rank_i)` where k=60
2. Merge results from code search, memory search, and graph expansion
3. Apply source weights to adjust contribution of each source
4. Deduplicate results (same symbol from multiple sources)
5. Return merged list sorted by RRF score

**Acceptance Criteria:**

1. RRF formula is correctly implemented with k=60
2. Source weights affect final ranking
3. Duplicate results are merged (not shown twice)
4. Final list is sorted by descending RRF score

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Tree-sitter Parsers | System | KSA-172 | AST parsing for symbol extraction and resolution |
| Graph Engine | System | KSA-173 | Call graph traversal, symbol resolver, test detector |
| SQLite Database | System | Existing | Storage for indexed symbols, call graph edges |
| Git CLI | External | N/A | Git history retrieval (optional, graceful degradation) |
| KSA-144 Batch 3 | External | KSA-144 | Node.js reference implementation must be complete |
| jtokkit | Library | N/A | Token counting library for JVM (optional, can use char/4 heuristic) |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Development Team Lead | Accept/reject implementation |
| Developer | Kotlin Dev | Implement the module |
| QA | QA Agent | Verify parity with Node.js |
| Architect | SA Agent | Design Kotlin-idiomatic architecture |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Graph Engine API differences between Node.js and Kotlin | High | Medium | Define clear interface contracts; adapter pattern if needed |
| Git operations may be slow on large repos | Medium | Medium | Use async/coroutines; cache git results; timeout after 2s |
| Token estimation divergence from Node.js | Low | Low | Use same heuristic (chars/4); add integration tests comparing outputs |
| FTS5 query syntax differences in Kotlin SQLite driver | Medium | Low | Use same SQLite FTS5 syntax; test with same queries |

### 5.2 Assumptions

- KSA-173 provides a `SymbolResolver` equivalent in Kotlin with same resolution capabilities
- KSA-173 provides `CallGraphService` with caller/callee traversal
- KSA-173 provides `TestDetector` for finding related tests
- SQLite database schema is shared with other Kotlin modules (same `DatabaseManager`)
- MCP tool registration follows existing pattern in Kotlin project
- Git CLI is available on the system (graceful degradation if not)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Response within 500ms | For typical get_ai_context/get_edit_context queries |
| Performance | Curated context within 1000ms | Involves FTS + graph traversal + RRF merge |
| Performance | Symbol resolution < 50ms | Database lookup with index |
| Compatibility | Output parity with Node.js | Same tool names, same parameter schemas, equivalent output format |
| Reliability | Graceful degradation | If git unavailable, skip git section; if graph empty, return source only |
| Maintainability | Strategy pattern for intents | Easy to add new intents without modifying core logic |
| Testability | Unit tests for each service | Verify context assembly, budget management, RRF merge |

---

## 7. Related Tickets

| Ticket Key | Summary | Type | Relationship |
|------------|---------|------|--------------|
| KSA-174 | [Kotlin] AI Context Tools | Story | Main ticket |
| KSA-171 | Code Intelligence v2 — Feature Parity Sync | Epic | Parent epic |
| KSA-172 | [Kotlin] Tree-sitter Core + Parsers | Story | Dependency (K1) |
| KSA-173 | [Kotlin] Graph Engine | Story | Dependency (K2) |
| KSA-175 | [Kotlin] Code Quality | Story | Sibling (K4) |
| KSA-176 | [Kotlin] Security Analysis | Story | Sibling (K5) |
| KSA-177 | [Kotlin] Similarity + Infrastructure | Story | Dependent on this (K6) |
| KSA-144 | mcp-code-intelligence-nodejs v2 | Epic | Source reference |
| KSA-158 | AI Context — get_ai_context | Story | Node.js implementation |
| KSA-159 | AI Context — get_edit_context | Story | Node.js implementation |
| KSA-160 | AI Context — get_curated_context | Story | Node.js implementation |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| MCP | Model Context Protocol — protocol for AI agent tool communication |
| RRF | Reciprocal Rank Fusion — algorithm for merging ranked lists from multiple sources |
| FTS5 | Full-Text Search 5 — SQLite extension for text search |
| AST | Abstract Syntax Tree — parsed representation of source code |
| Token | Unit of text for LLM context windows (~4 characters) |
| Intent | The purpose of the context request (explain/modify/debug/test) |

### MCP Tools Summary

| Tool Name | Category | Description |
|-----------|----------|-------------|
| `get_ai_context` | AI Context | Intent-aware code context with token budgeting |
| `get_edit_context` | Edit Context | Everything needed before editing a symbol |
| `get_curated_context` | Curated Context | Natural language query across codebase |

### Node.js Source Files (Reference)

| File | Purpose |
|------|---------|
| `src/tools/ai-context-tools.ts` | Tool definitions and handlers |
| `src/context/ai-context-service.ts` | Main AI context service |
| `src/context/edit-context-service.ts` | Edit context service |
| `src/context/curated-context-service.ts` | Curated context service |
| `src/context/token-budget-manager.ts` | Token budget management |
| `src/context/intent-strategies.ts` | Intent → section priority mapping |
| `src/context/rrf-merger.ts` | Reciprocal Rank Fusion algorithm |
| `src/context/git-service.ts` | Git history retrieval |
| `src/context/query-analyzer.ts` | Natural language query analysis |
| `src/context/budget-allocator.ts` | Budget allocation across sections |
