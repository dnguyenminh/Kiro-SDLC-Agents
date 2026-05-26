# Business Requirements Document (BRD)

## MCP Code Intelligence Python — KSA-179: [Python] Graph Engine

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-179 |
| Title | [Python] Graph Engine |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-25 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-179.docx |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | SA Agent – Solution Architect | Review technical feasibility |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-25 | BA Agent | Initiate document — inferred from PARALLEL-PLAN.md and nodejs source code |

---

## 1. Introduction

### 1.1 Scope

Port the Graph Engine module from `mcp-code-intelligence-nodejs` (TypeScript) to `mcp-code-intelligence-python`. This includes:

- **Call Graph Service** — BFS traversal for callers/callees with transitive depth control
- **Dependency Graph Service** — BFS traversal on import relationships (incoming/outgoing)
- **Impact Analysis Service** — Blast radius prediction combining call graph + dependency graph + test detection
- **Graph Traverser** — Generic BFS/DFS engine with edge/node type filtering
- **Symbol Resolver** — Resolves symbol names to database records (exact, qualified, file:symbol)
- **Test Detector** — Identifies test files and finds related tests for symbols

The Python implementation MUST produce identical output structures to the nodejs version to ensure API compatibility across language implementations.

### 1.2 Out of Scope

- Tree-sitter parsers (covered by KSA-178 / P1)
- AI Context tools (covered by KSA-180 / P3)
- Code Quality analysis (covered by KSA-181 / P4)
- Security Analysis (covered by KSA-182 / P5)
- Similarity/Infrastructure (covered by KSA-183 / P6)
- Frontend/UI components
- MCP protocol layer changes

### 1.3 Preliminary Requirements

| Prerequisite | Status | Ticket |
|-------------|--------|--------|
| Tree-sitter Core + Parsers (Python) | Must be complete | KSA-178 (P1) |
| KSA-144 Batch 2 (nodejs Graph Engine) | Reference implementation | KSA-144 |
| SQLite database schema with symbols/relationships tables | Must exist | KSA-178 |

---

## 2. Business Requirements

### 2.1 High Level Process Map

The Graph Engine provides code intelligence capabilities by analyzing relationships between code symbols (functions, classes, methods) stored in a SQLite database. It enables developers and AI agents to:

1. **Navigate code** — Find who calls a function, what a function calls
2. **Understand dependencies** — Map import/export relationships between files
3. **Predict impact** — Before modifying code, understand the blast radius
4. **Traverse graphs** — Generic graph traversal with configurable filters

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source |
|---|-----------------|----------|--------|
| 1 | As a developer, I want to find all callers of a function so that I can understand usage before refactoring | MUST HAVE | KSA-154 |
| 2 | As a developer, I want to find all callees of a function so that I can understand its dependencies | MUST HAVE | KSA-154 |
| 3 | As a developer, I want to query file dependency graphs so that I can understand module coupling | MUST HAVE | KSA-155 |
| 4 | As a developer, I want to detect circular dependencies so that I can fix architectural issues | MUST HAVE | KSA-155 |
| 5 | As a developer, I want to analyze impact before modifying a symbol so that I can assess risk | MUST HAVE | KSA-156 |
| 6 | As a developer, I want to traverse the code graph with custom filters so that I can explore relationships | MUST HAVE | KSA-157 |
| 7 | As a developer, I want symbol resolution with fuzzy matching so that I can find symbols without exact names | SHOULD HAVE | KSA-154 |
| 8 | As a developer, I want to find related test files for a symbol so that I know which tests to run | SHOULD HAVE | KSA-156 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Developer/AI agent invokes a graph tool (e.g., `code_callers`, `code_dependencies`, `code_impact`)

**Step 2:** Symbol Resolver resolves the input identifier to database record(s)

**Step 3:** Graph service performs BFS/DFS traversal on the relationships table

**Step 4:** Results are formatted with metadata (depth, truncation, timing) and returned

**Step 5:** For impact analysis, results from multiple services are combined and severity-classified

![Business Flow](diagrams/business-flow.png)

---

#### STORY 1: Find Callers (Call Graph — Incoming)

> As a developer, I want to find all callers of a function so that I can understand usage before refactoring

**Requirement Details:**

1. Accept symbol name input (exact, qualified `Class.method`, or `file:symbol` format)
2. Perform BFS traversal on `relationships` table where `kind = 'calls'`
3. Support configurable depth (1-5, default 1)
4. Support result limit (default 20)
5. Support file filter (glob pattern)
6. Return caller details: symbol name, qualified name, kind, file path, definition line, call site line, depth level

**Acceptance Criteria:**

1. Given a symbol name, when findCallers is called with depth=1, then only direct callers are returned
2. Given a symbol name, when findCallers is called with depth=3, then transitive callers up to 3 levels are returned
3. Given a non-existent symbol, when findCallers is called, then an empty result with suggestions is returned
4. Given a file filter, when findCallers is called, then only callers matching the filter are returned
5. Results include metadata: totalCount, depthSearched, truncated flag, queryTimeMs

---

#### STORY 2: Find Callees (Call Graph — Outgoing)

> As a developer, I want to find all callees of a function so that I can understand its dependencies

**Requirement Details:**

1. Accept symbol name input with same resolution strategies as Story 1
2. Perform BFS traversal following outgoing `calls` relationships
3. Support `includeExternal` flag (default true) to include/exclude external library calls
4. External calls shown with filePath = "(external)"
5. Same depth/limit/filter controls as Story 1

**Acceptance Criteria:**

1. Given a function, when findCallees is called, then all functions it calls are returned
2. Given includeExternal=false, when findCallees is called, then only project-internal callees are returned
3. Transitive callees are resolved by re-resolving callee symbols in the database

---

#### STORY 3: Dependency Graph Query

> As a developer, I want to query file dependency graphs so that I can understand module coupling

**Requirement Details:**

1. Accept file path input (resolved via FileResolver)
2. Support direction: `incoming` (who imports this file), `outgoing` (what does this file import), `both`
3. BFS traversal on `relationships` table where `kind = 'imports'`
4. Track imported symbols per dependency
5. Support `includeExternal` flag for third-party packages
6. Depth control (1-5, default 1)

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| file | string | Yes | Relative file path | `src/graph/traverser.py` |
| depth | int | Yes | Distance from root | 2 |
| importedSymbols | list[str] | Yes | Symbols imported | `["GraphNode", "TraverseConfig"]` |
| isExternal | bool | Yes | Third-party package? | false |

**Acceptance Criteria:**

1. Given a file, when query(direction='outgoing') is called, then all files it imports are returned
2. Given a file, when query(direction='incoming') is called, then all files that import it are returned
3. Given direction='both', then both incoming and outgoing are merged (deduplicated)
4. Metadata includes: totalNodes, maxDepthReached, truncated, queryTimeMs, externalCount

---

#### STORY 4: Circular Dependency Detection

> As a developer, I want to detect circular dependencies so that I can fix architectural issues

**Requirement Details:**

1. During BFS traversal, track the path from root to current node
2. If a node is encountered that already exists in the current path → cycle detected
3. Report all detected cycles as arrays of file paths
4. Cycles are reported in the `cycles` field of DependencyResult

**Acceptance Criteria:**

1. Given A imports B, B imports C, C imports A, when dependency query runs, then cycle [A, B, C, A] is detected
2. Multiple cycles can be detected in a single query
3. Cycle detection does not prevent traversal from continuing on non-cyclic paths

---

#### STORY 5: Impact Analysis (Blast Radius)

> As a developer, I want to analyze impact before modifying a symbol so that I can assess risk

**Requirement Details:**

1. Combine call graph (callers) + dependency graph (incoming) + test detection
2. Support actions: `modify`, `delete`, `rename`
3. Classify severity: `critical` (depth 1 + delete), `high` (depth 2 or rename), `medium` (depth 3), `low` (depth 4+)
4. Find interface implementors that would be affected
5. Generate actionable recommendations
6. Report blast radius summary: counts by severity, affected files, affected tests

**Acceptance Criteria:**

1. Given action='delete', when analyzeImpact is called, then all direct callers are classified as 'critical'
2. Given action='modify', when analyzeImpact is called, then direct callers are 'critical', depth-2 are 'high'
3. Related test files are automatically detected and included in results
4. Recommendations are generated based on impact severity and action type
5. Results are deduplicated (same file+symbol+line not repeated)

---

#### STORY 6: Generic Graph Traversal

> As a developer, I want to traverse the code graph with custom filters so that I can explore relationships

**Requirement Details:**

1. Accept start node (resolved via SymbolResolver)
2. Configurable edge types filter (e.g., only 'calls', or 'calls' + 'implements')
3. Configurable node types filter (e.g., only 'function', or 'class' + 'interface')
4. Direction: outgoing, incoming, both
5. BFS traversal with depth and result limits
6. Optional source code snippet inclusion

**Acceptance Criteria:**

1. Given edgeTypes=['calls'], when traverse is called, then only 'calls' edges are followed
2. Given nodeTypes=['function'], when traverse is called, then only function nodes are in results
3. Given includeSource=true, when traverse is called, then source code snippets are included
4. Results are sorted by depth (closest first)

---

#### STORY 7: Symbol Resolution

> As a developer, I want symbol resolution with fuzzy matching so that I can find symbols without exact names

**Requirement Details:**

1. Resolution strategies (in order): exact match → qualified name (Class.method) → file:symbol → fuzzy
2. Return: id, name, kind, filePath, line, parentSymbolId
3. Suggest similar names when no match found (LIKE query)

**Acceptance Criteria:**

1. Given exact name "processData", when resolve is called, then matching symbols are returned
2. Given qualified name "DataService.processData", when resolve is called, then the specific method is returned
3. Given "utils.py:helper", when resolve is called, then the symbol in that file is returned
4. Given non-existent name, when suggest is called, then similar names are returned

---

#### STORY 8: Test Detection

> As a developer, I want to find related test files for a symbol so that I know which tests to run

**Requirement Details:**

1. Detect test files by path patterns: `/tests?/`, `/__tests__/`, `/spec/`
2. Detect test files by name patterns: `.test.`, `.spec.`, `Test.kt`, `_test.py`, `test_*.py`
3. Find tests that import the source file of a given symbol
4. Include test files that are in the impact zone

**Acceptance Criteria:**

1. Given a symbol in `src/graph/traverser.py`, when findRelatedTests is called, then `tests/test_traverser.py` is found
2. Test detection works for Python, TypeScript, Kotlin test naming conventions
3. Both path-based and import-based test detection are used

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| KSA-178 (P1) | System | KSA-178 | Tree-sitter parsers must populate symbols/relationships tables |
| KSA-144 Batch 2 | Reference | KSA-144 | nodejs implementation as reference for API compatibility |
| NetworkX | Library | N/A | Python graph library for advanced graph algorithms |
| SQLite | Infrastructure | N/A | Database engine for symbol/relationship storage |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | KSA Team | Approve requirements, accept delivery |
| Developer | DEV Agent | Implement graph engine in Python |
| Architect | SA Agent | Design Python-specific architecture |
| QA | QA Agent | Verify feature parity with nodejs |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Performance gap vs nodejs (better-sqlite3 is faster than Python sqlite3) | Medium | High | Use connection pooling, prepared statements, batch queries |
| NetworkX overhead for simple traversals | Low | Medium | Use NetworkX only for complex algorithms; simple BFS uses raw SQL |
| Schema differences between Python and nodejs DB | High | Low | Verify schema compatibility in KSA-178 |

### 5.2 Assumptions

- KSA-178 has already created the SQLite database with `symbols`, `files`, and `relationships` tables
- The database schema matches the nodejs implementation (same column names and types)
- Python 3.11+ is the target runtime
- NetworkX is acceptable as a dependency for graph algorithms
- Output JSON structures must match nodejs exactly for API compatibility

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Query response < 500ms | For typical codebases (< 10K symbols), graph queries must complete within 500ms |
| Performance | Depth-5 traversal < 2s | Deep traversals with large result sets must complete within 2 seconds |
| Compatibility | API parity with nodejs | Response structures must be identical to nodejs implementation |
| Scalability | Support 100K+ symbols | Graph engine must handle large monorepo codebases |
| Reliability | Graceful degradation | Return empty results (not errors) for missing symbols/files |
| Testability | >80% code coverage | Unit tests for all services, integration tests for DB queries |

---

## 7. Related Tickets

| Ticket Key | Summary | Type | Relationship |
|------------|---------|------|--------------|
| KSA-179 | [Python] Graph Engine | Story | Main ticket |
| KSA-178 | [Python] Tree-sitter Core + Parsers | Story | Dependency (P1) |
| KSA-180 | [Python] AI Context Tools | Story | Dependent (P3) |
| KSA-181 | [Python] Code Quality | Story | Dependent (P4) |
| KSA-182 | [Python] Security Analysis | Story | Dependent (P5) |
| KSA-171 | Feature Parity Sync Epic | Epic | Parent epic |
| KSA-144 | Code Intelligence v2 (nodejs) | Epic | Source implementation |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Call Graph | Directed graph where edges represent function calls |
| Dependency Graph | Directed graph where edges represent import/export relationships between files |
| Blast Radius | Set of code elements affected by a change to a given symbol |
| BFS | Breadth-First Search — traversal algorithm exploring neighbors level by level |
| Symbol | A named code element (function, class, method, variable) stored in the database |
| Transitive | Following relationships through multiple levels (not just direct) |

### Reference Documents

| Document | Location |
|----------|----------|
| nodejs Graph Engine Source | `mcp-code-intelligence-nodejs/src/graph/` |
| Python Project | `mcp-code-intelligence-python/src/mcp_code_intel/` |
| PARALLEL-PLAN | `documents/KSA-171/PARALLEL-PLAN.md` |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
