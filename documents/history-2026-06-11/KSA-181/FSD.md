# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-181: [Python] Code Quality

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-181 |
| Title | [Python] Code Quality — Functional Specification |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-05-26 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-181.docx |
| Related FSD | FSD-v1-KSA-175.docx (Kotlin equivalent) |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the Code Quality module for the Python MCP Code Intelligence server.

### 1.2 Scope

Port 3 analyzer sub-modules from Node.js to Python:
- Complexity Analyzer (1 MCP tool) — using `radon` + tree-sitter counters
- Entry Point Detector (1 MCP tool) — with FastAPI/Flask/Django support
- Graph Analysis (5 MCP tools) — using `networkx`

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-181.docx |
| Kotlin FSD | FSD-v1-KSA-175.docx |
| Node.js Source | mcp-code-intelligence-nodejs/src/analyzers/ |

---

## 2. System Overview

### 2.1 System Context

The Code Quality module operates within the MCP Code Intelligence Python server:

- **Input**: AST nodes from Tree-sitter parsers (KSA-178), Call graph from Graph Engine (KSA-179)
- **Processing**: Complexity calculation (radon + counters), entry point detection, graph analysis (networkx)
- **Storage**: SQLite database via `aiosqlite` (shared with other modules)
- **Output**: MCP tool responses (text format) to AI agents

### 2.2 Module Architecture

```
mcp_code_intel/analyzers/quality/
├── __init__.py                    (module exports)
├── types.py                       (dataclasses and enums)
├── complexity/
│   ├── __init__.py
│   ├── analyzer.py                (ComplexityAnalyzer orchestrator)
│   ├── calculator.py              (ComplexityCalculator engine)
│   ├── store.py                   (ComplexityStore DB persistence)
│   ├── grade_assigner.py          (A-F grading)
│   ├── tool.py                    (MCP tool handler)
│   └── counters/
│       ├── __init__.py
│       ├── base.py                (BaseNodeCounter ABC)
│       ├── typescript_counter.py
│       ├── python_counter.py      (uses radon as primary)
│       ├── java_counter.py
│       ├── kotlin_counter.py
│       └── go_counter.py
├── entrypoints/
│   ├── __init__.py
│   ├── detector.py                (EntryPointDetector engine)
│   ├── store.py                   (EntryPointStore DB persistence)
│   ├── tool.py                    (MCP tool handler)
│   ├── framework_detector.py      (framework identification)
│   ├── pattern_registry.py        (pattern config)
│   └── route_resolver.py          (route path resolution)
└── graph_analysis/
    ├── __init__.py
    ├── circular_dep_detector.py   (networkx SCC)
    ├── dead_import_detector.py    (unused import finder)
    ├── hot_path_analyzer.py       (caller count analysis)
    ├── related_test_finder.py     (reverse BFS test finder)
    ├── module_summarizer.py       (aggregate metrics)
    ├── tools.py                   (MCP tool handlers)
    └── graph_loader.py            (load adjacency list from DB → networkx)
```

---

## 3. Functional Requirements

### 3.1 Feature: Complexity Analysis

#### 3.1.1 Use Case: UC-01 — Query Complexity Metrics

**Actor:** AI Agent (via MCP tool call)
**Preconditions:** Codebase indexed; complexity data in DB
**Postconditions:** Agent receives formatted complexity report

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Agent calls `complexity_analysis` | | With optional filters |
| 2 | | Validate input parameters | Parse and validate |
| 3 | | Query ComplexityStore | SQL with filters, sorting, limit |
| 4 | | Calculate summary statistics | Average CC, grade distribution |
| 5 | | Format text output | Human-readable report |
| 6 | | Return response | Send to agent |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | No filters | Return top 20 by complexity |
| AF-02 | grade_filter provided | Parse comma-separated, filter |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | No data in DB | "No complexity data found. Run indexing first." |
| EF-02 | Invalid grade_filter | Ignore invalid, use valid ones |

#### 3.1.2 Business Rules

| Rule ID | Rule |
|---------|------|
| BR-01 | CC = 1 + branches + loops + logical_ops + exception_handlers |
| BR-02 | Grade A: CC <= 5 |
| BR-03 | Grade B: 5 < CC <= 10 |
| BR-04 | Grade C: 10 < CC <= 20 |
| BR-05 | Grade D: 20 < CC <= 50 |
| BR-06 | Grade F: CC > 50 |
| BR-07 | Only functions/methods analyzed (not classes) |
| BR-07b | For .py files, use radon CC as primary |

#### 3.1.3 API Contract — `complexity_analysis`

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "file_path": { "type": "string" },
    "symbol_name": { "type": "string" },
    "min_complexity": { "type": "number" },
    "grade_filter": { "type": "string" },
    "module": { "type": "string" },
    "limit": { "type": "number" },
    "sort_by": { "type": "string" }
  }
}
```

**Output Format:**
```
Complexity Analysis — {total} functions found

Average CC: {avg} | Grade Distribution: A={n} B={n} C={n} D={n} F={n}

[{grade}] {symbol_name} — CC={cc} (branches={n} loops={n} logic={n} exceptions={n} depth={n})
    {file_path}:{start_line}-{end_line}
```

### 3.2 Feature: Entry Point Detection

#### 3.2.1 Use Case: UC-02 — Find Entry Points

**Business Rules:**

| Rule ID | Rule |
|---------|------|
| BR-08 | Entry types: HTTP_HANDLER, MAIN, CLI_COMMAND, EVENT_HANDLER, SCHEDULED |
| BR-09 | Frameworks: FastAPI, Flask, Django, Express, NestJS, Spring, Ktor, Gin |
| BR-10 | Auth: `Depends(get_current_user)`, `@login_required`, `@requires_auth` |
| BR-11 | Route resolution: APIRouter prefix + handler path = full_route |
| BR-12 | Confidence: High (decorator), Medium (heuristic), Low (naming) |

#### 3.2.2 API Contract — `find_entry_points`

**Output Format:**
```
Entry Points — {total} found

By Type: HTTP_HANDLER={n} MAIN={n} CLI_COMMAND={n}
By Framework: fastapi={n} flask={n} django={n}
Auth: {n} with auth, {n} without

  GET /api/users 🔒 → get_users
    src/routes/users.py:15 [fastapi]
  POST /api/users → create_user
    src/routes/users.py:30 [fastapi]
```

### 3.3 Feature: Circular Dependency Detection

Uses `networkx.strongly_connected_components()` on call graph DiGraph.

| Rule ID | Rule |
|---------|------|
| BR-13 | Severity HIGH: cycle length <= 3 |
| BR-14 | Severity MEDIUM: 3 < cycle length <= 6 |
| BR-15 | Severity LOW: cycle length > 6 |
| BR-16 | Use networkx SCC (O(V+E)) |

### 3.4 Feature: Dead Import Detection

**Input:** file_path (optional), module (optional), limit (default 50)
**Special:** Exclude `TYPE_CHECKING` imports, `__all__` re-exports.

### 3.5 Feature: Hot Path Analysis

**Input:** module (optional), limit (default 20), min_callers (default 2)
Uses `nx.ancestors(G, node)` for transitive caller count.

### 3.6 Feature: Related Test Finder

**Input:** symbol_name (required), file_path (optional), max_depth (default 3)
**Test detection:** pytest `test_*`, unittest `TestCase`, files in `tests/`.

### 3.7 Feature: Module Quality Summary

**Input:** module (optional)
Aggregates: file count, symbol count, circular deps, dead imports, avg complexity, hot paths.

---

## 4. Data Model

### 4.1 Database Tables

#### Table: complexity_results

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | INTEGER | No | Primary key (autoincrement) |
| symbol_id | INTEGER | No | FK to symbols.id (UNIQUE) |
| cyclomatic_complexity | INTEGER | No | Total CC score |
| branches | INTEGER | No | Branch count |
| loops | INTEGER | No | Loop count |
| logical_ops | INTEGER | No | Logical operator count |
| exception_handlers | INTEGER | No | Exception handler count |
| nesting_depth | INTEGER | No | Max nesting depth |
| early_returns | INTEGER | No | Early return count |
| grade | TEXT | No | A/B/C/D/F |
| updated_at | TEXT | No | ISO timestamp |

#### Table: entry_points

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | INTEGER | No | Primary key |
| symbol_id | INTEGER | No | FK to symbols.id (UNIQUE) |
| entry_type | TEXT | No | HTTP_HANDLER/MAIN/CLI_COMMAND/EVENT_HANDLER/SCHEDULED |
| framework | TEXT | Yes | Detected framework |
| http_method | TEXT | Yes | GET/POST/PUT/DELETE/PATCH |
| route_path | TEXT | Yes | Handler route |
| full_route | TEXT | Yes | Prefix + route |
| middleware | TEXT | Yes | JSON array |
| has_auth | INTEGER | No | 0 or 1 |
| controller | TEXT | Yes | Router/Blueprint name |
| confidence | TEXT | No | High/Medium/Low |
| updated_at | TEXT | No | ISO timestamp |

---

## 5. Processing Logic

### 5.1 Complexity (Python files — radon primary)

1. Read source → `radon.complexity.cc_visit(source)` → CC per function
2. Use `ast` module for breakdown (branches, loops, etc.)
3. Assign grade → upsert to DB

### 5.2 Complexity (non-Python — tree-sitter counters)

1. Get function body AST → select language counter
2. Count decision points → nesting → early returns
3. CC = 1 + sum → grade → upsert to DB

### 5.3 Graph Analysis (networkx)

```python
import networkx as nx

# Circular deps
sccs = nx.strongly_connected_components(G)
cycles = [scc for scc in sccs if len(scc) > 1]

# Hot paths
for node in G.nodes:
    direct = G.in_degree(node)
    transitive = len(nx.ancestors(G, node))

# Related tests
nx.bfs_tree(G.reverse(), target, depth_limit=max_depth)
```

---

## 6. Language Counters

| Language | Branches | Loops | Logical Ops | Exceptions |
|----------|----------|-------|-------------|------------|
| Python | if, elif, match case | for, while | and, or | except |
| TypeScript/JS | if, else if, case, ?: | for, while, do | &&, \|\| | catch |
| Java | if, else if, case | for, while, do | &&, \|\| | catch |
| Kotlin | if, when branch | for, while, do | &&, \|\| | catch |
| Go | if, else if, case | for, range | &&, \|\| | recover |

---

## 7. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | 1000 functions < 3s, queries < 100ms |
| Compatibility | Same tool names and output format as Node.js |
| Pythonic | Type hints, dataclasses, async/await |
| Reliability | Graceful skip on malformed AST |

---

## 8. Testing

| ID | Scenario | Priority |
|----|----------|----------|
| TC-01 | Simple function CC=1, Grade A | High |
| TC-02 | Complex function CC=15, Grade C | High |
| TC-03 | Python match statement CC | High |
| TC-04 | Circular dep detection | High |
| TC-05 | FastAPI handler detection | High |
| TC-06 | Dead import detection | Medium |
| TC-07 | radon vs tree-sitter parity | High |
| TC-08 | pytest test finder | Medium |
