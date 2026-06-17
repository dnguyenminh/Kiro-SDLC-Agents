# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-154: [Graph] Call Graph - callers/callees with transitive depth

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-154 |
| Title | [Graph] Call Graph - callers/callees with transitive depth |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-28 |
| Status | Draft |
| Parent Epic | KSA-144: Code Intelligence v2 — Graph Engine + Static Analysis |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-28 | BA Agent | Initial document — auto-generated from Jira ticket KSA-154 |

---

## 1. Introduction

### 1.1 Scope

Implement `code_callers` and `code_callees` MCP tools that query the graph data model to return:
- **Callers**: Who calls this function/method? (with transitive depth control)
- **Callees**: What does this function/method call? (with transitive depth control)
- **Chain visualization**: Caller/callee chain with symbol info, file, line

These are the primary **graph navigation tools** that AI agents use to understand code flow and impact.

### 1.2 Out of Scope

- Relationship extraction (KSA-145, KSA-146 — prerequisite)
- Graph data model (KSA-153 — prerequisite)
- Impact analysis tool (separate ticket)
- Dependency graph (imports-based, separate ticket)
- UI visualization of call graphs

### 1.3 Preliminary Requirements

- Graph data model with relationships table (KSA-153)
- Relationships populated by language parsers (KSA-146+)
- At least one language parser extracting `calls` relationships

---

## 2. Business Requirements

### 2.1 High Level Process Map

AI agents currently have no way to answer "who calls this function?" or "what does this function call?" — they must read entire files and guess. The call graph tools provide:
- Instant answers to caller/callee questions
- Transitive depth control (1-hop, 2-hop, N-hop)
- Impact assessment (if I change X, what breaks?)
- Understanding of code flow without reading all source files

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|-----------------|----------|---------------|
| 1 | As an AI agent, I want to find all callers of a function so I can assess change impact | MUST HAVE | KSA-154 |
| 2 | As an AI agent, I want to find all callees of a function so I can understand its dependencies | MUST HAVE | KSA-154 |
| 3 | As an AI agent, I want transitive depth control so I can see N levels of the call chain | MUST HAVE | KSA-154 |
| 4 | As an AI agent, I want caller/callee results with file path and line number for navigation | MUST HAVE | KSA-154 |
| 5 | As an AI agent, I want to limit results to avoid overwhelming context windows | SHOULD HAVE | KSA-154 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** AI agent needs to understand impact of changing a function

**Step 2:** Agent calls `code_callers(symbol="parseConfig", depth=2)`

**Step 3:** Tool queries relationships table: find all symbols where target = "parseConfig" AND kind = "calls"

**Step 4:** For depth > 1, recursively find callers of callers (BFS traversal)

**Step 5:** Return structured result with caller chain, file paths, line numbers

**Step 6:** Agent uses this to determine blast radius and plan changes

---

#### STORY 1: code_callers Tool

> As an AI agent, I want to find all callers of a function so I can assess change impact before modifying code.

**MCP Tool Interface:**

```
Tool: code_callers
Parameters:
  - symbol: string (required) — symbol name or qualified name
  - depth: integer (optional, default=1) — transitive depth (1=direct only, 2=callers of callers, etc.)
  - limit: integer (optional, default=20) — max results
  - file_filter: string (optional) — glob pattern to filter results by file path

Returns:
  - callers: array of { symbol, file_path, line, depth_level, kind }
  - total_count: integer (total before limit)
  - truncated: boolean
```

**Example Request:**
```json
{
  "symbol": "parseConfig",
  "depth": 2,
  "limit": 10
}
```

**Example Response:**
```json
{
  "callers": [
    { "symbol": "initApp", "file_path": "src/app.ts", "line": 42, "depth_level": 1, "kind": "function" },
    { "symbol": "reloadConfig", "file_path": "src/config.ts", "line": 15, "depth_level": 1, "kind": "function" },
    { "symbol": "main", "file_path": "src/index.ts", "line": 8, "depth_level": 2, "kind": "function" },
    { "symbol": "startServer", "file_path": "src/server.ts", "line": 22, "depth_level": 2, "kind": "function" }
  ],
  "total_count": 4,
  "truncated": false
}
```

**Acceptance Criteria:**

1. `code_callers` returns all direct callers (depth=1) of a given symbol
2. Transitive callers returned when depth > 1 (BFS, not DFS to avoid deep recursion)
3. Each result includes symbol name, file_path, line number, and depth_level
4. Results ordered by depth_level (closest callers first)
5. Limit parameter caps results (with truncated flag)
6. Handles symbols with no callers gracefully (empty array)
7. Query completes in <100ms for depth=1, <500ms for depth=3

---

#### STORY 2: code_callees Tool

> As an AI agent, I want to find all callees of a function so I can understand its dependencies and behavior.

**MCP Tool Interface:**

```
Tool: code_callees
Parameters:
  - symbol: string (required) — symbol name or qualified name
  - depth: integer (optional, default=1) — transitive depth
  - limit: integer (optional, default=20) — max results
  - file_filter: string (optional) — glob pattern to filter

Returns:
  - callees: array of { symbol, file_path, line, depth_level, kind }
  - total_count: integer
  - truncated: boolean
```

**Acceptance Criteria:**

1. `code_callees` returns all functions called by the given symbol (depth=1)
2. Transitive callees returned when depth > 1
3. Each result includes target symbol name, file where call occurs, line number
4. External/unresolved callees included with `file_path: null`
5. Query completes in <100ms for depth=1

---

#### STORY 3: Transitive Depth Control

> As an AI agent, I want transitive depth control so I can see exactly N levels of the call chain without overwhelming my context.

**Requirement Details:**

1. depth=1: Only direct callers/callees
2. depth=2: Direct + one level of indirection
3. depth=N: N levels of BFS traversal
4. depth=0 or unspecified: Default to 1
5. Maximum depth cap at 5 (prevent runaway queries)
6. Cycle detection: If A calls B calls A, don't loop infinitely

**Acceptance Criteria:**

1. depth parameter correctly controls traversal levels
2. BFS traversal (breadth-first) ensures closest results first
3. Cycle detection prevents infinite loops in recursive call patterns
4. Maximum depth capped at 5 regardless of input
5. Each result tagged with its `depth_level` for context

---

#### STORY 4: Rich Result Metadata

> As an AI agent, I want caller/callee results with file path and line number so I can navigate directly to relevant code.

**Result Fields:**

| Field | Type | Description |
|-------|------|-------------|
| symbol | string | Caller/callee symbol name |
| qualified_name | string | Full qualified name (e.g., `ClassName.method`) |
| kind | string | Symbol kind (function, method, class, etc.) |
| file_path | string | File where the symbol is defined |
| line | integer | Line number of the call site |
| depth_level | integer | How many hops from the queried symbol |
| parameters | string | Parameter signature (if available) |
| is_async | boolean | Whether the caller/callee is async |

**Acceptance Criteria:**

1. All fields populated where data is available
2. `qualified_name` includes class prefix for methods
3. `file_path` is relative to workspace root
4. `line` points to the call site (not the function definition)

---

#### STORY 5: Result Limiting and Filtering

> As an AI agent, I want to limit results to avoid overwhelming my context window with too many callers.

**Acceptance Criteria:**

1. `limit` parameter caps number of results (default 20)
2. `truncated: true` flag when more results exist than limit
3. `total_count` shows actual count regardless of limit
4. `file_filter` glob pattern filters results (e.g., `src/**/*.ts` excludes tests)
5. Results sorted by relevance: depth_level ASC, then file proximity

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Graph data model (KSA-153) | System | KSA-153 | Relationships table with indexes |
| TypeScript parser (KSA-146) | System | KSA-146 | Populates call relationships |
| Tree-sitter core (KSA-145) | System | KSA-145 | Parsing infrastructure |
| MCP server framework | System | N/A | Tool registration and invocation |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Development Team Lead | Approve tool interface |
| Developer | Code Intelligence Team | Implement graph traversal |
| QA | QA Team | Verify accuracy and performance |
| Users | AI Agents (Claude, etc.) | Primary consumers of call graph data |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Incomplete relationship data (parsers miss calls) | Medium | Medium | Iterative parser improvement |
| Performance with deep transitive queries | Medium | Medium | Cap depth at 5, optimize BFS |
| Ambiguous symbol names (multiple matches) | Medium | High | Use qualified names, return all matches |
| Circular call patterns cause issues | Low | Medium | Cycle detection in BFS |

### 5.2 Assumptions

- Relationships table (KSA-153) is populated with call edges before this tool is useful
- BFS traversal is preferred over DFS for call graph exploration
- AI agents typically need depth 1-3 (rarely deeper)
- Unresolved external calls (npm packages) are excluded from transitive traversal

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | depth=1 query <100ms | Direct callers/callees |
| Performance | depth=3 query <500ms | 3-level transitive |
| Scalability | Handle 100K+ relationships | Without timeout |
| Reliability | Graceful on empty graph | Return empty array, not error |
| Usability | Clear error messages | When symbol not found |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-154 | [Graph] Call Graph | To Do | Task | Main ticket |
| KSA-144 | Code Intelligence v2 — Graph Engine + Static Analysis | To Do | Epic | Parent epic |
| KSA-153 | [Graph] Data Model & Storage | To Do | Task | Prerequisite (storage) |
| KSA-145 | [Tree-sitter] Core Integration | To Do | Task | Prerequisite (parsing) |
| KSA-146 | [Tree-sitter] TypeScript/JavaScript Parser | To Do | Task | Populates call data |
| KSA-158 | [AI Context] get_ai_context | To Do | Task | Uses call graph |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Caller | A function that invokes another function |
| Callee | A function that is invoked by another function |
| Transitive | Following the chain recursively (caller of caller) |
| BFS | Breadth-First Search — explore all neighbors before going deeper |
| Blast radius | Set of code affected by a change (all transitive callers) |

### Reference Documents

| Document | Location |
|----------|----------|
| CodeGraph vs FEC Comparison | documents/CodeGraph-vs-FEC-Comparison.md |
| CodeGraph call graph tools | Section 3 of comparison doc |
