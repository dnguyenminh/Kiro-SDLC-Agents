# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-163: [Quality] Circular Deps + Related Tests + Hot Paths

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-163 |
| Title | [Quality] Circular Deps + Related Tests + Hot Paths |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-06-05 |
| Status | Draft |
| Parent Epic | KSA-144: Code Intelligence v2 — Graph Engine + Static Analysis |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-05 | BA Agent | Initial document — auto-generated from Jira ticket KSA-163 |

---

## 1. Introduction

### 1.1 Scope

This ticket implements three related code quality analysis features that leverage the dependency graph (KSA-155) and call graph (KSA-154):

1. **Circular Dependency Detection** — Find circular import/dependency chains between modules
2. **Related Test Discovery** — Find tests related to a given function via call graph traversal
3. **Hot Path Analysis** — Identify most-called functions (by transitive caller count) + dead imports + module summary

**Key deliverables:**
- Circular dependency detector using DFS cycle detection on dependency graph
- Related test finder using reverse call graph traversal
- Hot path analyzer computing transitive caller counts
- Dead import detector (imports never used)
- Module summary generator (file count, functions, language breakdown)
- MCP tools: `find_circular_deps`, `find_related_tests`, `find_hot_paths`, `find_dead_imports`, `module_summary`

### 1.2 Out of Scope

- Dependency graph construction (KSA-155 — prerequisite)
- Call graph construction (KSA-154 — prerequisite)
- Impact analysis (KSA-156 — separate ticket, uses same graph)
- Cyclomatic complexity (KSA-161 — separate ticket)
- Security analysis (KSA-164, KSA-165)
- Module coupling/instability scores (future enhancement)

### 1.3 Preliminary Requirements

- KSA-155: Dependency Graph must be complete (import relationships stored)
- KSA-154: Call Graph must be complete (caller/callee relationships stored)
- KSA-153: Graph data model (relationships table in SQLite)
- KSA-145: Tree-sitter core (for import statement parsing)

---

## 2. Business Requirements

### 2.1 High Level Process Map

The dependency and call graphs (KSA-154, KSA-155) store raw relationships. This ticket builds **analysis tools** on top of those graphs to answer higher-level questions:

- "Are there circular dependencies in my codebase?" → architectural smell detection
- "Which tests cover this function?" → test coverage mapping without instrumentation
- "Which functions are called most often?" → performance hot spots
- "Which imports are unused?" → dead code cleanup
- "What does this module contain?" → codebase overview

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|-----------------|----------|---------------|
| 1 | As a developer, I want circular dependencies detected so that I can fix architectural issues | MUST HAVE | KSA-163 |
| 2 | As a developer, I want to find tests related to a function so that I know what to run after changes | MUST HAVE | KSA-163 |
| 3 | As a tech lead, I want hot path analysis so that I can identify performance-critical functions | MUST HAVE | KSA-163 |
| 4 | As a developer, I want dead imports detected so that I can clean up unused dependencies | SHOULD HAVE | KSA-163 |
| 5 | As a developer, I want module summaries so that I can understand codebase structure | SHOULD HAVE | KSA-163 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Developer requests analysis (via MCP tool call)

**Step 2:** System loads relevant graph data (dependency graph or call graph) from SQLite

**Step 3:** System runs graph algorithm (DFS for cycles, BFS for reachability, counting for hot paths)

**Step 4:** Results computed and returned via MCP tool response

**Step 5:** For indexing-time analysis (dead imports, module summary): computed during index and cached

---

#### STORY 1: Circular Dependency Detection

> As a developer, I want circular dependencies detected so that I can fix architectural issues.

**Requirement Details:**

1. Detect circular import chains at module/file level
2. Algorithm: DFS-based cycle detection on dependency graph (Tarjan's or Johnson's)
3. Report all cycles found, not just the first one
4. For each cycle, report:
   - Chain of modules involved (A → B → C → A)
   - Length of cycle
   - Files involved with line numbers of import statements
   - Severity (2-node cycle = High, 3+ = Medium)
5. Support both direct cycles (A→B→A) and transitive cycles (A→B→C→A)

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| cycle_id | integer | Yes | Unique cycle identifier | 1 |
| chain | string[] | Yes | Ordered list of modules in cycle | ["auth.ts", "user.ts", "auth.ts"] |
| length | integer | Yes | Number of edges in cycle | 2 |
| severity | string | Yes | High (2-node) / Medium (3+) | "High" |
| files | object[] | Yes | File + line of each import | [{file: "auth.ts", line: 5, imports: "user.ts"}] |

**MCP Tool: `find_circular_deps`**

Input:
- `module` (optional): Check specific module only
- `max_depth` (optional): Max cycle length to report (default: 10)
- `severity_filter` (optional): "High" or "Medium"

**Acceptance Criteria:**

1. Detects all circular dependency chains in the codebase
2. Reports cycle chain with exact import locations
3. No false positives (only actual import cycles reported)
4. Performance: < 1s for codebases with 1000 files
5. Handles both ES module imports and CommonJS require()

---

#### STORY 2: Related Test Discovery

> As a developer, I want to find tests related to a function so that I know what to run after changes.

**Requirement Details:**

1. Given a function/symbol, find all test functions that call it (directly or transitively)
2. Algorithm: Reverse BFS on call graph from target function, filtering for test files
3. Test file identification:
   - Files matching patterns: `*.test.*`, `*.spec.*`, `*_test.*`, `test_*.*`
   - Files in directories: `__tests__/`, `tests/`, `test/`, `spec/`
   - Functions with test decorators: `@Test`, `@pytest.mark`, `it()`, `describe()`
4. Report:
   - Direct tests (call target directly)
   - Indirect tests (call target through intermediary functions)
   - Call chain from test to target

**MCP Tool: `find_related_tests`**

Input:
- `symbol_name` (required): Function/method to find tests for
- `file_path` (optional): Disambiguate if multiple symbols with same name
- `max_depth` (optional): Max call chain depth (default: 5)
- `include_indirect` (optional): Include indirect tests (default: true)

Output:
```json
{
  "target": "processPayment",
  "direct_tests": [
    {"test": "test_process_payment_success", "file": "tests/test_payment.py", "line": 42}
  ],
  "indirect_tests": [
    {"test": "test_checkout_flow", "file": "tests/test_checkout.py", "line": 15, "chain": ["checkout", "processPayment"]}
  ],
  "coverage_score": 0.85
}
```

**Acceptance Criteria:**

1. Finds all test functions that directly call the target
2. Finds indirect tests up to configurable depth
3. Correctly identifies test files across Python, TypeScript, Java, Go conventions
4. Reports call chain for indirect tests
5. Performance: < 500ms for functions with up to 50 callers

---

#### STORY 3: Hot Path Analysis

> As a tech lead, I want hot path analysis so that I can identify performance-critical functions.

**Requirement Details:**

1. Compute "hotness" score for each function based on transitive caller count
2. Hotness = number of unique entry points that can reach this function
3. Functions called by many entry points are "hot" (high blast radius if they break)
4. Report top-N hottest functions with:
   - Transitive caller count
   - Direct caller count
   - Entry points that reach it
   - Complexity grade (from KSA-161 if available)

**MCP Tool: `find_hot_paths`**

Input:
- `limit` (optional): Top N results (default: 20)
- `min_callers` (optional): Minimum transitive caller count
- `module` (optional): Filter by module
- `include_complexity` (optional): Include CC grade (default: true)

**Acceptance Criteria:**

1. Correctly computes transitive caller count for all functions
2. Returns top-N hottest functions sorted by caller count
3. Includes entry point reachability information
4. Performance: < 2s for codebases with 5000 functions
5. Integrates with complexity data when available

---

#### STORY 4: Dead Import Detection

> As a developer, I want dead imports detected so that I can clean up unused dependencies.

**Requirement Details:**

1. For each import statement, check if imported symbol is used in the file
2. "Used" means: referenced in function bodies, type annotations, or re-exported
3. Report unused imports with:
   - File path and line number
   - Imported symbol name
   - Source module
   - Confidence level (High if definitely unused, Medium if might be used dynamically)

**MCP Tool: `find_dead_imports`**

Input:
- `file_path` (optional): Check specific file
- `module` (optional): Check all files in module
- `confidence` (optional): Minimum confidence ("High" or "Medium")

**Acceptance Criteria:**

1. Detects imports where imported symbol has zero references in file
2. Does not flag type-only imports used in type annotations
3. Does not flag re-exports
4. Confidence scoring: High for definitely unused, Medium for potentially dynamic usage
5. Performance: < 100ms per file

---

#### STORY 5: Module Summary

> As a developer, I want module summaries so that I can understand codebase structure.

**Requirement Details:**

1. Per-module summary including:
   - File count by language
   - Function/class/interface count
   - Total lines of code
   - Average complexity (if KSA-161 available)
   - External dependency count
   - Entry point count (if KSA-162 available)
2. Workspace-level summary aggregating all modules

**MCP Tool: `module_summary`**

Input:
- `module` (optional): Specific module (default: all)
- `include_details` (optional): Include per-file breakdown

**Acceptance Criteria:**

1. Accurate file count and language breakdown per module
2. Correct function/class counts from symbol index
3. Integrates with complexity and entry point data when available
4. Performance: < 500ms for workspace summary

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Dependency Graph | System | KSA-155 | Import relationships for circular dep detection |
| Call Graph | System | KSA-154 | Caller/callee relationships for test discovery + hot paths |
| Graph Data Model | System | KSA-153 | SQLite relationships table |
| Tree-sitter Core | System | KSA-145 | Import statement parsing for dead imports |
| Cyclomatic Complexity | Optional | KSA-161 | Enriches hot path data with CC grades |
| Entry Point Detection | Optional | KSA-162 | Enriches hot path data with entry point info |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Development Team Lead | Approve requirements, prioritize |
| Developer | Code Intelligence Team | Implement graph analysis algorithms |
| QA | QA Team | Verify algorithm correctness |
| Users | AI Agent developers, Tech leads | Consume analysis results |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Large codebases cause slow graph traversal | Medium | Medium | Limit depth, cache results, incremental updates |
| Incomplete call graph leads to missed related tests | Medium | High | Document coverage limitations, improve over time |
| Dynamic imports create false negatives for dead import detection | Medium | High | Confidence scoring, flag dynamic patterns |
| Circular deps in node_modules/vendor pollute results | Low | High | Exclude external dependencies by default |

### 5.2 Assumptions

- Dependency graph (KSA-155) provides complete import relationships
- Call graph (KSA-154) provides function-level caller/callee data
- Test file conventions are consistent within a project
- Graph algorithms (DFS, BFS) are efficient enough for codebases up to 10K files

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Circular dep detection < 1s | For 1000-file codebases |
| Performance | Related test discovery < 500ms | Per function query |
| Performance | Hot path analysis < 2s | For 5000-function codebases |
| Accuracy | Zero false positives for circular deps | Only real import cycles |
| Accuracy | Related tests >= 90% recall | Compared to manual identification |
| Scalability | Handles 10K+ file codebases | With reasonable response times |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-163 | [Quality] Circular Deps + Related Tests + Hot Paths | To Do | Task | Main ticket |
| KSA-144 | Code Intelligence v2 — Graph Engine + Static Analysis | To Do | Epic | Parent epic |
| KSA-155 | [Graph] Dependency Graph | To Do | Task | Prerequisite (import graph) |
| KSA-154 | [Graph] Call Graph | To Do | Task | Prerequisite (call relationships) |
| KSA-156 | [Graph] Impact Analysis | To Do | Task | Related (uses same graph) |
| KSA-161 | [Quality] Cyclomatic Complexity | To Do | Task | Optional enrichment |
| KSA-162 | [Quality] Entry Point Detection | To Do | Task | Optional enrichment |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Circular Dependency | A cycle in the import/dependency graph (A imports B, B imports A) |
| Hot Path | A function with high transitive caller count (many paths lead to it) |
| Dead Import | An import statement whose imported symbol is never used in the file |
| Transitive Caller | A function that can reach the target through a chain of calls |
| Related Test | A test function that exercises the target function directly or indirectly |

### Reference Documents

| Document | Location |
|----------|----------|
| CodeGraph vs FEC Comparison | documents/CodeGraph-vs-FEC-Comparison.md |
| KSA-155 BRD (Dependency Graph) | documents/KSA-155/BRD.md |
| KSA-154 BRD (Call Graph) | documents/KSA-154/BRD.md |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
