# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-164: [Security] Control Flow + Data Flow Analysis

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-164 |
| Title | [Security] Control Flow + Data Flow Analysis |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-06-05 |
| Status | Draft |
| Parent Epic | KSA-144: Code Intelligence v2 — Graph Engine + Static Analysis |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-05 | BA Agent | Initial document — auto-generated from Jira ticket KSA-164 |

---

## 1. Introduction

### 1.1 Scope

This ticket implements Control Flow Graph (CFG) construction and Data Flow / Taint Tracing analysis. These are foundational capabilities for security static analysis — they enable tracking execution paths through functions and tracing how data flows from sources (user input) to sinks (dangerous operations).

**Key deliverables:**
- Control Flow Graph (CFG) builder from tree-sitter AST
- CFG representation: basic blocks, edges (sequential, branch, loop-back, exception)
- Data Flow Analysis: variable definition-use chains (def-use)
- Taint Tracing: track tainted data from sources to sinks
- Taint source/sink registry (configurable per framework)
- MCP tools: `control_flow_analysis`, `data_flow_analysis`, `taint_trace`
- Support for 6 languages (TypeScript/JS, Python, Kotlin, Java, Go, Rust)

### 1.2 Out of Scope

- Injection detection patterns (KSA-165 — uses CFG/DFG from this ticket)
- SBOM generation / dependency audit (future tickets)
- SSRF / IDOR detection (future tickets)
- Inter-procedural analysis (cross-function taint — future enhancement)
- Runtime taint tracking (only static analysis)

### 1.3 Preliminary Requirements

- KSA-145: Tree-sitter core integration (AST parsing)
- KSA-154: Call Graph (for inter-procedural context, optional)
- Tree-sitter grammars for all 6 target languages
- Understanding of common taint sources/sinks per framework

---

## 2. Business Requirements

### 2.1 High Level Process Map

Security vulnerabilities often involve data flowing from untrusted sources to dangerous sinks without proper sanitization. To detect these:

1. **Control Flow Graph** — maps all possible execution paths through a function
2. **Data Flow Analysis** — tracks where variables are defined and used
3. **Taint Tracing** — marks data from untrusted sources and follows it through the CFG

Together, these enable detection of:
- SQL injection (user input → SQL query without parameterization)
- XSS (user input → HTML output without escaping)
- Command injection (user input → shell execution)
- Path traversal (user input → file system access)
- And 16+ more injection patterns (KSA-165)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|-----------------|----------|---------------|
| 1 | As a security engineer, I want CFG for functions so that I can understand all execution paths | MUST HAVE | KSA-164 |
| 2 | As a security engineer, I want data flow analysis so that I can track variable definitions and uses | MUST HAVE | KSA-164 |
| 3 | As a security engineer, I want taint tracing so that I can find data flowing from sources to sinks | MUST HAVE | KSA-164 |
| 4 | As an AI agent, I want to query CFG/DFG via MCP tools so that I can provide security analysis | MUST HAVE | KSA-164 |
| 5 | As a developer, I want configurable taint sources/sinks so that I can customize for my framework | SHOULD HAVE | KSA-164 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Developer requests security analysis (via MCP tool or during indexing)

**Step 2:** System parses target function with tree-sitter to get AST

**Step 3:** CFG builder converts AST into basic blocks with edges

**Step 4:** Data flow analyzer computes def-use chains for all variables

**Step 5:** Taint analyzer marks taint sources, propagates through CFG following data flow

**Step 6:** If tainted data reaches a sink without sanitization → report vulnerability

**Step 7:** Results returned via MCP tool with path from source to sink

---

#### STORY 1: Control Flow Graph Construction

> As a security engineer, I want CFG for functions so that I can understand all execution paths.

**Requirement Details:**

1. Build CFG from tree-sitter AST for any function
2. CFG consists of:
   - **Basic Blocks**: sequences of statements with no branches
   - **Edges**: connections between blocks (types: sequential, branch-true, branch-false, loop-back, exception, return)
   - **Entry/Exit nodes**: single entry, potentially multiple exits
3. Handle control structures:
   - if/else → branch-true + branch-false edges
   - for/while → loop-back edge
   - try/catch → exception edge
   - return/break/continue → early exit edges
   - switch/match → multiple branch edges
4. CFG stored as adjacency list in memory (not persisted — computed on demand)

**Data Fields (CFG Block):**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| block_id | integer | Yes | Unique block ID within function | 3 |
| statements | object[] | Yes | AST nodes in this block | [{type: "assignment", line: 15}] |
| start_line | integer | Yes | First line of block | 15 |
| end_line | integer | Yes | Last line of block | 18 |
| successors | integer[] | Yes | IDs of successor blocks | [4, 5] |
| predecessors | integer[] | Yes | IDs of predecessor blocks | [2] |
| edge_types | object | Yes | Edge type to each successor | {4: "branch-true", 5: "branch-false"} |

**Acceptance Criteria:**

1. CFG correctly represents all execution paths for functions in 6 languages
2. if/else creates exactly 2 successor edges (true/false)
3. Loops create back-edges to loop header
4. try/catch creates exception edges to catch blocks
5. Early returns create edges to exit node
6. CFG for a 100-line function computed in < 50ms

---

#### STORY 2: Data Flow Analysis

> As a security engineer, I want data flow analysis so that I can track variable definitions and uses.

**Requirement Details:**

1. Compute definition-use (def-use) chains for all variables in a function
2. For each variable, track:
   - **Definitions**: where the variable is assigned a value
   - **Uses**: where the variable is read
   - **Reaching definitions**: which definitions can reach each use
3. Handle:
   - Simple assignments: `x = expr`
   - Destructuring: `const {a, b} = obj`
   - Parameter definitions (function params are initial defs)
   - Reassignment: `x = new_value` kills previous def
   - Augmented assignment: `x += 1` is both use and def

**Data Fields (Def-Use Chain):**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| variable | string | Yes | Variable name | "userInput" |
| definitions | object[] | Yes | Where defined | [{line: 5, block: 1, expr: "req.body"}] |
| uses | object[] | Yes | Where used | [{line: 10, block: 3, context: "sql_query"}] |
| reaching_defs | object | Yes | Which defs reach which uses | {use_line_10: [def_line_5]} |

**Acceptance Criteria:**

1. Correctly identifies all variable definitions and uses
2. Reaching definitions computed accurately (handles reassignment)
3. Function parameters treated as initial definitions
4. Destructuring assignments handled correctly
5. Analysis completes in < 100ms for functions up to 200 lines

---

#### STORY 3: Taint Tracing

> As a security engineer, I want taint tracing so that I can find data flowing from sources to sinks.

**Requirement Details:**

1. **Taint Sources** — data from untrusted origins:
   - HTTP request parameters: `req.body`, `req.query`, `req.params`, `request.form`
   - Environment variables: `os.environ`, `process.env`
   - File reads: `fs.readFile`, `open().read()`
   - Database results: `cursor.fetchone()`, `query.first()`
   - User input: `input()`, `readline()`

2. **Taint Sinks** — dangerous operations:
   - SQL execution: `cursor.execute()`, `query()`, `raw()`
   - Shell execution: `exec()`, `subprocess.run()`, `child_process.exec()`
   - File system: `fs.writeFile()`, `open(path, 'w')`
   - HTML output: `innerHTML`, `render()`, `Response()`
   - Eval: `eval()`, `Function()`, `exec()`

3. **Taint Propagation Rules:**
   - Assignment: `y = tainted_x` → y is tainted
   - String concatenation: `s = "prefix" + tainted` → s is tainted
   - Function call with tainted arg: depends on function (configurable)
   - Collection operations: `list.append(tainted)` → list is tainted

4. **Sanitizers** — operations that remove taint:
   - Parameterized queries: `cursor.execute("SELECT ?", [param])`
   - Escape functions: `escape_html()`, `sanitize()`, `encodeURIComponent()`
   - Type casting: `int(user_input)` removes string-based taint
   - Validation: `validator.isEmail()`, regex validation

5. **Output**: For each source-to-sink path found:
   - Source location (file, line, expression)
   - Sink location (file, line, expression)
   - Path through CFG (list of blocks/lines)
   - Whether any sanitizer was applied on the path
   - Vulnerability type (SQL injection, XSS, etc.)
   - Confidence level (High if no sanitizer, Medium if partial)

**MCP Tool: `taint_trace`**

Input:
- `file_path` (optional): Analyze specific file
- `symbol_name` (optional): Analyze specific function
- `source_type` (optional): Filter by source type (http, env, file, db)
- `sink_type` (optional): Filter by sink type (sql, shell, fs, html, eval)
- `include_sanitized` (optional): Include paths with sanitizers (default: false)

**Acceptance Criteria:**

1. Correctly identifies taint sources from configurable registry
2. Propagates taint through assignments, concatenations, and function calls
3. Recognizes sanitizers that remove taint
4. Reports source-to-sink paths with full trace
5. Zero false negatives for direct source→sink (no intermediate functions)
6. Intra-procedural analysis (within single function) in < 200ms

---

#### STORY 4: MCP Tool Exposure

> As an AI agent, I want to query CFG/DFG via MCP tools so that I can provide security analysis.

**Requirement Details:**

Three MCP tools:

1. **`control_flow_analysis`** — Get CFG for a function
   - Input: symbol_name, file_path
   - Output: blocks, edges, paths count, complexity

2. **`data_flow_analysis`** — Get def-use chains
   - Input: symbol_name, file_path, variable (optional)
   - Output: def-use chains, reaching definitions

3. **`taint_trace`** — Find taint paths
   - Input: file_path, symbol_name, source_type, sink_type
   - Output: vulnerability findings with paths

**Acceptance Criteria:**

1. All three MCP tools registered and callable
2. CFG tool returns valid graph structure
3. Data flow tool returns accurate def-use chains
4. Taint trace tool returns actionable vulnerability findings
5. Each tool responds in < 500ms for typical functions

---

#### STORY 5: Configurable Source/Sink Registry

> As a developer, I want configurable taint sources/sinks so that I can customize for my framework.

**Requirement Details:**

1. Default registry with common sources/sinks per language/framework
2. Custom registry via configuration file (`taint-config.json`):
```json
{
  "sources": [
    {"pattern": "req.body.*", "type": "http", "language": "typescript"},
    {"pattern": "request.form.*", "type": "http", "language": "python"}
  ],
  "sinks": [
    {"pattern": "cursor.execute(*)", "type": "sql", "language": "python"},
    {"pattern": "child_process.exec(*)", "type": "shell", "language": "typescript"}
  ],
  "sanitizers": [
    {"pattern": "escape_html(*)", "removes": "xss", "language": "python"},
    {"pattern": "parameterized query", "removes": "sql", "language": "*"}
  ]
}
```
3. Registry extensible without code changes

**Acceptance Criteria:**

1. Default registry covers top 10 sources and sinks per language
2. Custom entries from config file loaded and applied
3. Sanitizer patterns correctly neutralize taint
4. New patterns can be added without restarting server

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Tree-sitter core | System | KSA-145 | AST parsing for CFG construction |
| Call Graph | Optional | KSA-154 | Inter-procedural context (future) |
| Graph Data Model | System | KSA-153 | Relationship storage patterns |
| Injection Detection | Downstream | KSA-165 | Uses CFG/DFG for pattern matching |
| Language parsers | System | KSA-146, KSA-147 | Language-specific AST nodes |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Development Team Lead | Approve requirements, prioritize |
| Developer | Code Intelligence Team | Implement CFG/DFG/Taint engines |
| Security Engineer | Security Team | Define sources/sinks, validate findings |
| QA | QA Team | Verify analysis accuracy |
| Users | AI Agent developers | Consume security analysis results |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Intra-procedural only misses cross-function taint | High | High | Document limitation, plan inter-procedural in v2 |
| Complex control flow (generators, async/await) hard to model | Medium | Medium | Start with synchronous, add async support iteratively |
| High false positive rate for taint analysis | Medium | Medium | Confidence scoring, sanitizer recognition |
| Performance on large functions (500+ lines) | Medium | Low | Limit analysis depth, warn on large functions |

### 5.2 Assumptions

- Intra-procedural analysis (single function) is the MVP scope
- Tree-sitter AST provides sufficient detail for CFG construction
- Taint propagation through simple assignments is straightforward
- Sanitizer patterns can be reliably detected via AST pattern matching
- Inter-procedural analysis (cross-function) deferred to future enhancement

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | CFG construction < 50ms per function | For functions up to 200 lines |
| Performance | Data flow analysis < 100ms per function | Def-use chain computation |
| Performance | Taint trace < 200ms per function | Single function analysis |
| Accuracy | Zero false negatives for direct source→sink | Within single function |
| Accuracy | False positive rate < 20% | With sanitizer recognition |
| Configurability | Sources/sinks/sanitizers configurable | Via JSON config file |
| Extensibility | New languages addable | Via AST node type mapping |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-164 | [Security] Control Flow + Data Flow Analysis | To Do | Task | Main ticket |
| KSA-144 | Code Intelligence v2 — Graph Engine + Static Analysis | To Do | Epic | Parent epic |
| KSA-145 | [Tree-sitter] Core Integration | To Do | Task | Prerequisite (AST) |
| KSA-154 | [Graph] Call Graph | To Do | Task | Related (inter-procedural context) |
| KSA-165 | [Security] Injection Detection (20 patterns) | To Do | Task | Downstream (uses CFG/DFG) |
| KSA-161 | [Quality] Cyclomatic Complexity | To Do | Task | Related (CFG complexity) |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| CFG | Control Flow Graph — directed graph of basic blocks representing execution paths |
| Basic Block | Sequence of statements with single entry and single exit |
| DFG | Data Flow Graph — tracks how data values flow through a program |
| Def-Use Chain | Links variable definitions to their uses |
| Taint | Marker indicating data originates from untrusted source |
| Source | Origin of untrusted data (user input, network, file) |
| Sink | Dangerous operation where tainted data causes vulnerability |
| Sanitizer | Operation that removes taint (validation, escaping, parameterization) |

### Reference Documents

| Document | Location |
|----------|----------|
| CodeGraph vs FEC Comparison | documents/CodeGraph-vs-FEC-Comparison.md |
| CodeGraph Security Tools (Section 6) | Section 6 of comparison doc |
| OWASP Injection Prevention | https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html |
| Static Taint Analysis | https://en.wikipedia.org/wiki/Taint_checking |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
