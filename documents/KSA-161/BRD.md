# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-161: [Quality] Cyclomatic Complexity - AST-based grading A-F

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-161 |
| Title | [Quality] Cyclomatic Complexity - AST-based grading A-F |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-06-05 |
| Status | Draft |
| Parent Epic | KSA-144: Code Intelligence v2 — Graph Engine + Static Analysis |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-05 | BA Agent | Initial document — auto-generated from Jira ticket KSA-161 |

---

## 1. Introduction

### 1.1 Scope

This ticket implements AST-based cyclomatic complexity calculation for the MCP Code Intelligence system. Using the tree-sitter AST infrastructure (KSA-145), the system will analyze function bodies to compute cyclomatic complexity scores, provide detailed breakdowns (branches, loops, logical operators, nesting depth, early returns), and assign letter grades A-F.

**Key deliverables:**
- Cyclomatic complexity calculator using tree-sitter AST nodes
- Complexity breakdown by category (branches, loops, logical ops, nesting, early returns)
- Letter grading system A-F with configurable thresholds
- MCP tool `complexity_analysis` exposing results to AI agents
- Per-function and per-file aggregate complexity metrics
- Support for 6 languages (TypeScript/JS, Python, Kotlin, Java, Go, Rust)

### 1.2 Out of Scope

- Tree-sitter core integration (KSA-145 — prerequisite, already done)
- Language-specific parser implementations (KSA-146, KSA-147 — prerequisite)
- Relationship extraction / graph engine (KSA-153, KSA-154)
- Entry point detection (KSA-162 — separate ticket)
- Circular dependency detection (KSA-163 — separate ticket)
- Security analysis (KSA-164, KSA-165 — separate tickets)
- Cognitive complexity (future enhancement)

### 1.3 Preliminary Requirements

- KSA-145: Tree-sitter core integration must be complete (AST parsing infrastructure)
- KSA-146: TypeScript/JS parser must be available (for TS/JS complexity)
- Tree-sitter grammars installed for target languages
- Existing symbol extraction producing AST nodes with body ranges

---

## 2. Business Requirements

### 2.1 High Level Process Map

The current code intelligence system extracts symbols but provides NO complexity metrics. Developers and AI agents cannot assess code quality, identify overly complex functions, or prioritize refactoring targets.

This feature adds:
- **Per-function complexity scoring** — quantitative measure of code complexity
- **Breakdown analysis** — understand WHY a function is complex (too many branches? deep nesting?)
- **Letter grading A-F** — quick visual indicator for code review
- **Aggregate metrics** — file-level and module-level complexity summaries
- **MCP tool exposure** — AI agents can query complexity for context-aware suggestions

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|-----------------|----------|---------------|
| 1 | As a developer, I want cyclomatic complexity calculated for each function so that I can identify overly complex code | MUST HAVE | KSA-161 |
| 2 | As a developer, I want complexity breakdown (branches, loops, nesting) so that I understand what makes a function complex | MUST HAVE | KSA-161 |
| 3 | As a developer, I want letter grades A-F so that I can quickly assess function quality | MUST HAVE | KSA-161 |
| 4 | As an AI agent, I want to query complexity via MCP tool so that I can provide refactoring suggestions | MUST HAVE | KSA-161 |
| 5 | As a tech lead, I want file/module aggregate complexity so that I can identify problem areas in the codebase | SHOULD HAVE | KSA-161 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Developer requests complexity analysis (via MCP tool call or during indexing)

**Step 2:** System identifies target functions from the symbol index (tree-sitter AST)

**Step 3:** For each function, system traverses AST body nodes counting complexity contributors

**Step 4:** System calculates cyclomatic complexity score: CC = 1 + branches + loops + logical_ops + exception_handlers

**Step 5:** System computes breakdown metrics (branches, loops, logical ops, nesting depth, early returns)

**Step 6:** System assigns letter grade based on configurable thresholds

**Step 7:** Results stored in complexity table (SQLite) and returned via MCP tool response

---

#### STORY 1: Cyclomatic Complexity Calculation

> As a developer, I want cyclomatic complexity calculated for each function so that I can identify overly complex code.

**Requirement Details:**

1. Traverse function body AST nodes to count decision points
2. Decision points include:
   - `if` / `else if` / `elif` statements
   - `for` / `while` / `do-while` / `for-in` / `for-of` loops
   - `switch` / `case` / `when` branches
   - `&&` / `||` / `and` / `or` logical operators in conditions
   - `try` / `catch` / `except` exception handlers
   - Ternary operators (`? :`)
   - Pattern matching arms (`match` / `when` with multiple cases)
   - Null-coalescing operators (`??`, `?.`)
3. Formula: `CC = 1 + sum(decision_points)`
4. Support languages: TypeScript/JS, Python, Kotlin, Java, Go, Rust

**AST Node Types per Language:**

| Language | Branch Nodes | Loop Nodes | Logical Ops | Exception |
|----------|-------------|------------|-------------|-----------|
| TypeScript/JS | if_statement, switch_case, ternary_expression | for_statement, while_statement, do_statement, for_in_statement | binary_expression(&&/\|\|) | catch_clause |
| Python | if_statement, elif_clause, match_case | for_statement, while_statement | boolean_operator(and/or) | except_clause |
| Kotlin | if_expression, when_entry | for_statement, while_statement, do_while_statement | conjunction_expression, disjunction_expression | catch_block |
| Java | if_statement, switch_block_statement_group | for_statement, while_statement, do_statement, enhanced_for_statement | binary_expression(&&/\|\|) | catch_clause |
| Go | if_statement, expression_case | for_statement | binary_expression(&&/\|\|) | — |
| Rust | if_expression, match_arm | for_expression, while_expression, loop_expression | binary_expression(&&/\|\|) | — |

**Acceptance Criteria:**

1. Cyclomatic complexity correctly calculated for functions in all 6 supported languages
2. Score matches manual calculation within +/-1 for test corpus of 50 functions
3. Functions with no decision points score CC = 1
4. Nested conditions counted correctly (each `if` inside another `if` adds 1, not 2)
5. Short-circuit operators (`&&`, `||`) each count as 1 decision point

---

#### STORY 2: Complexity Breakdown

> As a developer, I want complexity breakdown (branches, loops, nesting) so that I understand what makes a function complex.

**Requirement Details:**

1. Provide per-function breakdown with counts for each category:
   - `branches`: if/else/switch/case/ternary count
   - `loops`: for/while/do-while count
   - `logical_ops`: &&/|| operators in conditions
   - `nesting_depth`: maximum nesting level (0 = flat)
   - `early_returns`: return/break/continue statements before function end
   - `exception_handlers`: try/catch/except blocks
2. Nesting depth calculated as max depth of nested control structures
3. Early returns counted as statements that exit before the natural end

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| symbol_id | integer | Yes | FK to symbols table | 42 |
| cyclomatic_complexity | integer | Yes | Total CC score | 8 |
| branches | integer | Yes | if/else/switch count | 4 |
| loops | integer | Yes | for/while count | 2 |
| logical_ops | integer | Yes | &&/\|\| count | 1 |
| nesting_depth | integer | Yes | Max nesting level | 3 |
| early_returns | integer | Yes | return/break/continue | 1 |
| exception_handlers | integer | Yes | try/catch count | 0 |
| grade | string | Yes | Letter grade A-F | "C" |

**Acceptance Criteria:**

1. Breakdown sums correctly: branches + loops + logical_ops + exception_handlers = CC - 1
2. Nesting depth accurately reflects deepest control structure nesting
3. Early returns counted only for return/break/continue that exit before function end
4. Breakdown available for every function with CC > 1

---

#### STORY 3: Letter Grading A-F

> As a developer, I want letter grades A-F so that I can quickly assess function quality.

**Requirement Details:**

1. Default grading thresholds (configurable):

| Grade | CC Range | Description | Color |
|-------|----------|-------------|-------|
| A | 1-5 | Simple, low risk | Green |
| B | 6-10 | Moderate complexity | Blue |
| C | 11-20 | Complex, consider refactoring | Yellow |
| D | 21-35 | Very complex, refactoring recommended | Orange |
| F | 36+ | Extremely complex, high risk | Red |

2. Thresholds configurable via `index-config.json`
3. Grade stored alongside CC score in database

**Acceptance Criteria:**

1. Every function with calculated CC receives a letter grade
2. Grades match threshold configuration exactly
3. Custom thresholds from config override defaults
4. Grade "A" for CC=1 (simplest function), "F" for CC>=36

---

#### STORY 4: MCP Tool Exposure

> As an AI agent, I want to query complexity via MCP tool so that I can provide refactoring suggestions.

**Requirement Details:**

1. New MCP tool: `complexity_analysis`
2. Input parameters:
   - `file_path` (optional): Analyze specific file
   - `symbol_name` (optional): Analyze specific function/method
   - `min_complexity` (optional): Filter results by minimum CC
   - `grade_filter` (optional): Filter by grade (e.g., "D,F" for problematic functions)
   - `limit` (optional): Max results (default 20)
   - `sort_by` (optional): "complexity" (desc) or "name" (asc)
3. Output includes per-function results with breakdown + summary with grade distribution

**Acceptance Criteria:**

1. MCP tool `complexity_analysis` registered and callable
2. Supports filtering by file, symbol, min_complexity, grade
3. Returns breakdown for each function
4. Includes summary with grade distribution
5. Response time < 500ms for files with up to 100 functions

---

#### STORY 5: Aggregate Metrics

> As a tech lead, I want file/module aggregate complexity so that I can identify problem areas in the codebase.

**Requirement Details:**

1. Per-file aggregates: total functions, average CC, max CC, grade distribution
2. Per-module aggregates: same metrics across all files in module
3. "Hot spots" identification: top N most complex functions across codebase
4. Trend data (if historical data available): complexity change over time

**Acceptance Criteria:**

1. File-level summary available via `complexity_analysis` with `file_path` parameter
2. Module-level summary available via `complexity_analysis` with module filter
3. Top-N hot spots returned when no filter specified (sorted by CC desc)
4. Summary includes grade distribution histogram

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Tree-sitter core integration | System | KSA-145 | AST parsing infrastructure required |
| TypeScript/JS parser | System | KSA-146 | Language-specific AST node types |
| Python parser | System | KSA-147 | Python AST node types |
| Symbol index (symbols table) | System | KSA-145 | Function symbols with line ranges |
| SQLite database | Infrastructure | N/A | Storage for complexity metrics |
| index-config.json | Configuration | N/A | Threshold configuration |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Development Team Lead | Approve requirements, prioritize |
| Developer | Code Intelligence Team | Implement complexity calculator |
| QA | QA Team | Verify calculation accuracy |
| Users | AI Agent developers | Consume complexity data for suggestions |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| AST node types differ between tree-sitter grammar versions | Medium | Medium | Pin grammar versions, test per language |
| Complex expressions (nested ternaries, chained ?.) miscounted | Medium | Medium | Comprehensive test corpus per language |
| Performance impact on large files (>5000 lines) | Low | Low | Lazy calculation, cache results |
| Different complexity standards (CC vs cognitive) cause confusion | Low | Medium | Document clearly that this is McCabe CC |

### 5.2 Assumptions

- Tree-sitter AST provides sufficient node type granularity for all decision points
- McCabe cyclomatic complexity is the standard (not cognitive complexity)
- Grading thresholds align with industry standards (SonarQube, CodeClimate)
- Complexity calculated only for functions/methods (not classes or modules directly)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Single function analysis < 5ms | AST traversal of function body |
| Performance | File analysis (100 functions) < 500ms | Batch processing |
| Accuracy | CC score within +/-1 of manual calculation | Validated against test corpus |
| Storage | Complexity data < 100 bytes per function | Efficient SQLite storage |
| Configurability | Thresholds configurable without code change | Via index-config.json |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-161 | [Quality] Cyclomatic Complexity - AST-based grading A-F | To Do | Task | Main ticket |
| KSA-144 | Code Intelligence v2 — Graph Engine + Static Analysis | To Do | Epic | Parent epic |
| KSA-145 | [Tree-sitter] Core Integration | To Do | Task | Prerequisite (AST infrastructure) |
| KSA-146 | [Tree-sitter] TypeScript/JavaScript Parser | To Do | Task | Prerequisite (TS/JS nodes) |
| KSA-162 | [Quality] Entry Point & HTTP Handler Detection | To Do | Task | Related (uses same AST) |
| KSA-163 | [Quality] Circular Deps + Related Tests + Hot Paths | To Do | Task | Related (hot paths use complexity) |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Cyclomatic Complexity (CC) | McCabe's metric measuring the number of linearly independent paths through a function |
| AST | Abstract Syntax Tree — structured representation of source code |
| Decision Point | A point in code where execution can branch (if, loop, logical op) |
| Nesting Depth | Maximum level of nested control structures within a function |
| Grade | Letter classification (A-F) based on CC thresholds |

### Reference Documents

| Document | Location |
|----------|----------|
| CodeGraph vs FEC Comparison | documents/CodeGraph-vs-FEC-Comparison.md |
| McCabe Complexity Standard | https://en.wikipedia.org/wiki/Cyclomatic_complexity |
| SonarQube Complexity Rules | https://rules.sonarsource.com/java/RSPEC-1541 |
| Tree-sitter Node Types | https://tree-sitter.github.io/tree-sitter/using-parsers |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
