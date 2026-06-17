# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-181: [Python] Code Quality

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-181 |
| Title | [Python] Code Quality — Port code quality analysis tools from Node.js to Python |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-26 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-175.docx (Kotlin equivalent) |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-26 | BA Agent | Initial document — adapted from KSA-175 (Kotlin) for Python track |

---

## 1. Introduction

### 1.1 Scope

Port the Code Quality analysis module from the Node.js MCP Code Intelligence server (`mcp-code-intelligence-nodejs/src/analyzers/`) to the Python implementation (`mcp-code-intelligence-python/src/mcp_code_intel/analyzers/quality/`). This includes:

- **Cyclomatic Complexity Analysis**: Calculate CC for functions/methods using `radon` library + `ast` module, with A-F grading
- **Entry Point Detection**: Detect HTTP handlers (FastAPI, Flask, Django), main functions, CLI commands (Click, argparse), event handlers
- **Graph Analysis**: Circular dependency detection using `networkx`, dead import detection, hot path analysis, related test finder, module summarizer

The Python implementation must expose the same MCP tool interfaces and produce equivalent output to the Node.js version.

### 1.2 Out of Scope

- Security analysis tools (covered by KSA-182)
- Similarity/duplicate detection (covered by KSA-183)
- Kotlin track implementation (covered by KSA-175)
- Changes to the Node.js reference implementation
- UI/frontend changes

### 1.3 Preliminary Requirements

- KSA-178 (Tree-sitter Core + Parsers for Python) must be complete — provides AST parsing
- KSA-179 (Graph Engine for Python) must be complete — provides call graph and dependency graph data structures
- Existing Python project structure with `mcp_code_intel` package hierarchy
- Python 3.11+ with `networkx`, `radon`, `tree-sitter` dependencies

---

## 2. Business Requirements

### 2.1 High Level Process Map

The Code Quality module integrates into the MCP Code Intelligence pipeline:

1. **Indexing Phase**: During file indexing, the quality analyzers process parsed AST nodes to compute metrics
2. **Storage Phase**: Results are persisted to SQLite database tables
3. **Query Phase**: MCP tools expose quality data to AI agents via tool calls

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source |
|---|------------------|----------|--------|
| 1 | As an AI agent, I want to analyze cyclomatic complexity of functions so that I can identify overly complex code | MUST HAVE | KSA-161 |
| 2 | As an AI agent, I want to find entry points (HTTP handlers, main functions) so that I can understand application architecture | MUST HAVE | KSA-162 |
| 3 | As an AI agent, I want to detect circular dependencies so that I can identify architectural issues | MUST HAVE | KSA-163 |
| 4 | As an AI agent, I want to find dead/unused imports so that I can suggest cleanup | MUST HAVE | KSA-163 |
| 5 | As an AI agent, I want to identify hot paths (most-called functions) so that I can prioritize optimization | MUST HAVE | KSA-163 |
| 6 | As an AI agent, I want to find tests related to a symbol so that I can assess test coverage | SHOULD HAVE | KSA-163 |
| 7 | As an AI agent, I want a module quality summary so that I can get an overview of code health | SHOULD HAVE | KSA-163 |

---

### 2.3 Details of User Stories

#### Business Flow

**Step 1:** User indexes a codebase via `code_index_status` tool (triggers indexing)

**Step 2:** Indexing engine parses files using tree-sitter, extracts symbols, builds call graph

**Step 3:** Quality analyzers run on indexed symbols:
- ComplexityAnalyzer calculates CC for each function/method (using `radon` for Python files, tree-sitter counters for others)
- EntryPointDetector identifies HTTP handlers, main functions, etc.
- Graph analysis uses `networkx` DiGraph for circular dep detection

**Step 4:** Results are stored in SQLite tables (`complexity_results`, `entry_points`, etc.)

**Step 5:** AI agent calls MCP tools (`complexity_analysis`, `find_entry_points`, `find_circular_deps`, etc.)

**Step 6:** Tool handlers query stored results, format output, return to agent

---

#### STORY 1: Cyclomatic Complexity Analysis

> As an AI agent, I want to analyze cyclomatic complexity of functions so that I can identify overly complex code and suggest refactoring.

**Requirement Details:**

1. Calculate cyclomatic complexity (CC) for every function/method in the indexed codebase
2. Use `radon` library for Python source files (native CC calculation)
3. Use tree-sitter AST + language-specific counters for non-Python files
4. Supported languages: TypeScript, JavaScript, Python, Java, Kotlin, Go
5. Provide breakdown: branches, loops, logical operators, exception handlers, nesting depth, early returns
6. Assign letter grades: A (CC <= 5), B (CC <= 10), C (CC <= 20), D (CC <= 50), F (CC > 50)
7. Store results in database for fast querying
8. Support filtering by: file path, symbol name, minimum complexity, grade, module
9. Support sorting by: complexity (default), name, file

**Acceptance Criteria:**

1. Tool `complexity_analysis` is registered and callable via MCP protocol
2. CC calculation matches Node.js reference implementation for all supported languages
3. For Python files, `radon` provides native CC (cross-validated with tree-sitter counter)
4. Grade assignment is consistent: A<=5, B<=10, C<=20, D<=50, F>50
5. Results include full breakdown (branches, loops, logical_ops, exception_handlers, nesting_depth, early_returns)
6. Query supports all filter combinations
7. Output format matches Node.js version (text-based, human-readable)
8. Performance: analyze 1000 functions in < 3 seconds

---

#### STORY 2: Entry Point Detection

> As an AI agent, I want to find entry points (HTTP handlers, main functions, CLI commands) so that I can understand application architecture.

**Requirement Details:**

1. Detect entry points by type: HTTP_HANDLER, MAIN, CLI_COMMAND, EVENT_HANDLER, SCHEDULED
2. Support framework detection: FastAPI, Flask, Django, Express, NestJS, Spring, Ktor, Gin
3. For HTTP handlers: extract method, route path, full route, middleware, auth presence
4. Detect auth indicators (decorators: `@login_required`, `@requires_auth`, `Depends(get_current_user)`)
5. Support confidence levels: High, Medium, Low
6. Store results in database
7. Support filtering by: entry type, framework, HTTP method, route pattern, auth presence, file path

**Acceptance Criteria:**

1. Tool `find_entry_points` is registered and callable via MCP protocol
2. Correctly detects HTTP handlers for supported frameworks (especially FastAPI/Flask/Django)
3. Route resolution handles nested/prefixed routes (APIRouter prefixes in FastAPI)
4. Auth detection identifies common Python patterns (`Depends()`, decorators, middleware)
5. Summary includes counts by type, by framework, and auth coverage
6. Output format matches Node.js version

---

#### STORY 3: Circular Dependency Detection

> As an AI agent, I want to detect circular dependencies so that I can identify architectural issues.

**Acceptance Criteria:**

1. Tool `find_circular_deps` is registered and callable
2. Correctly identifies all SCCs using `networkx.strongly_connected_components()`
3. Severity classification matches Node.js implementation (HIGH <= 3, MEDIUM <= 6, LOW > 6)
4. Output shows cycle chain (A -> B -> C -> A) with file paths

---

#### STORY 4: Dead Import Detection

> As an AI agent, I want to find dead/unused imports so that I can suggest cleanup.

**Acceptance Criteria:**

1. Tool `find_dead_imports` is registered and callable
2. Correctly identifies unused imports across supported languages
3. No false positives for re-exports, `__all__` declarations, or `TYPE_CHECKING` imports
4. Output includes file:line and import details

---

#### STORY 5: Hot Path Analysis

> As an AI agent, I want to identify hot paths (most-called functions) so that I can prioritize optimization.

**Acceptance Criteria:**

1. Tool `find_hot_paths` is registered and callable
2. Transitive caller count uses networkx BFS on reverse call graph
3. Results sorted by transitive caller count descending
4. Output matches Node.js format

---

#### STORY 6: Related Test Finder

> As an AI agent, I want to find tests related to a symbol so that I can assess test coverage.

**Acceptance Criteria:**

1. Tool `find_related_tests` is registered and callable
2. Correctly identifies test files/functions (pytest `test_*`, unittest `TestCase`)
3. Call chain path is accurate
4. Max depth parameter limits search scope

---

#### STORY 7: Module Quality Summary

> As an AI agent, I want a module quality summary so that I can get an overview of code health.

**Acceptance Criteria:**

1. Tool `module_summary` is registered and callable
2. Aggregates data from complexity, graph analysis, and dead import detectors
3. Output provides actionable overview per module

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Tree-sitter Parsers | System | KSA-178 | AST parsing for complexity calculation |
| Graph Engine | System | KSA-179 | Call graph and dependency graph (networkx DiGraph) |
| SQLite Database | System | Existing | Storage for complexity results, entry points |
| radon | Library | — | Native Python cyclomatic complexity calculation |
| networkx | Library | — | Graph algorithms (SCC, BFS, shortest path) |
| KSA-144 Batch 4 | External | KSA-144 | Node.js reference implementation must be complete |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Development Team Lead | Accept/reject implementation |
| Developer | Python Dev | Implement the module |
| QA | QA Agent | Verify parity with Node.js |
| Architect | SA Agent | Design Pythonic architecture |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| `radon` CC calculation may differ from tree-sitter counter | Medium | Medium | Cross-validate; use radon as primary for .py files |
| `networkx` memory usage on large graphs (100K+ nodes) | High | Low | Use generators, limit graph loading to module scope |
| Python GIL limits parallelism for CPU-bound CC calculation | Medium | Medium | Use `concurrent.futures.ProcessPoolExecutor` for heavy computation |
| tree-sitter Python bindings may have different AST node types | Medium | Low | Validate against Node.js tree-sitter output |

### 5.2 Assumptions

- KSA-178 provides tree-sitter Python bindings with same traversal API as Node.js
- KSA-179 provides networkx-based graph structure compatible with SCC algorithms
- SQLite database schema is shared with other Python modules (same `db.py` DatabaseManager)
- MCP tool registration follows existing pattern in `tools.py`
- Python 3.11+ is the minimum supported version

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Analyze 1000 functions in < 3s | Leverage radon's C extension for Python files |
| Performance | Query response < 100ms | Database queries with proper indexing |
| Compatibility | Output parity with Node.js | Same tool names, same output format |
| Maintainability | Strategy pattern for language counters | Easy to add new language support |
| Testability | pytest tests for each counter | Verify CC calculation correctness |
| Pythonic | Use dataclasses, type hints, async/await | Follow Python best practices |

---

## 7. Related Tickets

| Ticket Key | Summary | Type | Relationship |
|------------|---------|------|--------------|
| KSA-181 | [Python] Code Quality | Story | Main ticket |
| KSA-171 | Code Intelligence v2 — Feature Parity Sync | Epic | Parent epic |
| KSA-175 | [Kotlin] Code Quality | Story | Parallel implementation |
| KSA-178 | [Python] Tree-sitter Core + Parsers | Story | Dependency (P1) |
| KSA-179 | [Python] Graph Engine | Story | Dependency (P2) |
| KSA-144 | mcp-code-intelligence-nodejs v2 | Epic | Source reference |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| CC | Cyclomatic Complexity — measure of code complexity based on decision points |
| SCC | Strongly Connected Components — graph algorithm for cycle detection |
| MCP | Model Context Protocol — protocol for AI agent tool communication |
| AST | Abstract Syntax Tree — parsed representation of source code |
| BFS | Breadth-First Search — graph traversal algorithm |
| radon | Python library for code metrics (CC, Halstead, maintainability index) |
| networkx | Python library for graph creation, manipulation, and algorithms |

### MCP Tools Summary

| Tool Name | Category | Description |
|-----------|----------|-------------|
| `complexity_analysis` | Complexity | Query cyclomatic complexity with filters |
| `find_entry_points` | Entry Points | Find HTTP handlers, main functions, etc. |
| `find_circular_deps` | Graph Analysis | Detect circular dependencies (networkx SCC) |
| `find_related_tests` | Graph Analysis | Find tests for a given symbol |
| `find_hot_paths` | Graph Analysis | Find most-called functions |
| `find_dead_imports` | Graph Analysis | Find unused imports |
| `module_summary` | Graph Analysis | Module-level quality overview |

### Python-Specific Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| `radon` | >= 6.0 | Cyclomatic complexity for Python source |
| `networkx` | >= 3.2 | Graph algorithms (SCC, BFS, DFS) |
| `tree-sitter` | >= 0.22 | Multi-language AST parsing |
| `aiosqlite` | >= 0.20 | Async SQLite access |
| `pytest` | >= 8.0 | Testing framework |
