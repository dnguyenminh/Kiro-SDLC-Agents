# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-161: [Quality] Cyclomatic Complexity - AST-based grading A-F

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-161 |
| Title | [Quality] Cyclomatic Complexity - AST-based grading A-F |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-06-05 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-161.docx |

---

## 1. Use Cases

### UC-161-01: Calculate Cyclomatic Complexity for Single Function

**Actor:** AI Agent / Developer (via MCP tool)

**Preconditions:** Function exists in symbol index with tree-sitter AST available

**Main Flow:**
1. User calls `complexity_analysis` with `symbol_name` parameter
2. System looks up symbol in symbols table
3. System retrieves AST for function body from tree-sitter parse cache
4. System traverses AST counting decision points per category
5. System computes CC = 1 + sum(decision_points)
6. System assigns grade based on threshold config
7. System returns result with breakdown

**Alternative Flows:**
- 2a. Symbol not found → return error "Symbol not found"
- 3a. AST not available (grammar missing) → return error "Language not supported"
- 4a. Function body is empty → return CC=1, grade="A"

**Exception Flows:**
- E1. Tree-sitter parse error → log warning, skip function, continue with others
- E2. Timeout (>5s) → abort, return partial results

---

### UC-161-02: Batch Complexity Analysis for File

**Actor:** AI Agent / Developer

**Preconditions:** File exists and has been indexed

**Main Flow:**
1. User calls `complexity_analysis` with `file_path` parameter
2. System queries all function symbols in that file
3. For each function, execute UC-161-01 flow
4. System computes file-level aggregates (avg, max, distribution)
5. System returns per-function results + file summary

**Alternative Flows:**
- 2a. No functions in file → return empty results with summary showing 0 functions
- 3a. Some functions fail → include successful results, note failures

---

### UC-161-03: Filter by Grade/Complexity

**Actor:** Tech Lead / AI Agent

**Preconditions:** Complexity data exists (computed during indexing or on-demand)

**Main Flow:**
1. User calls `complexity_analysis` with `grade_filter="D,F"` or `min_complexity=20`
2. System queries complexity table with filter
3. System returns matching functions sorted by complexity (desc)
4. System includes summary with total matching vs total functions

---

### UC-161-04: Compute During Indexing

**Actor:** System (automatic)

**Preconditions:** File change detected, tree-sitter parse complete

**Main Flow:**
1. Indexer detects file change (mtime + hash)
2. After symbol extraction, indexer triggers complexity calculation
3. For each function symbol extracted, compute CC + breakdown
4. Store results in `complexity` table
5. Results available immediately for MCP tool queries

---

## 2. Business Rules

| ID | Rule | Rationale |
|----|------|-----------|
| BR-161-01 | CC minimum is always 1 (even for empty functions) | McCabe standard: 1 path always exists |
| BR-161-02 | Each `if`/`elif`/`else if` adds exactly 1 to CC | Standard branch counting |
| BR-161-03 | Each loop (`for`/`while`/`do-while`) adds exactly 1 | Loop creates additional path |
| BR-161-04 | Each `&&`/`||` operator adds exactly 1 | Short-circuit creates branch |
| BR-161-05 | Each `catch`/`except` block adds exactly 1 | Exception path |
| BR-161-06 | `else` does NOT add to CC (already counted by `if`) | Standard McCabe |
| BR-161-07 | `switch`/`match` — each `case`/arm adds 1 (not the switch itself) | Per-case counting |
| BR-161-08 | Ternary operator (`? :`) adds exactly 1 | Equivalent to if/else |
| BR-161-09 | Null-coalescing (`??`) adds exactly 1 | Creates branch path |
| BR-161-10 | Nesting depth is max depth, not cumulative | Industry standard |
| BR-161-11 | Grade thresholds are configurable via index-config.json | Flexibility for teams |
| BR-161-12 | Complexity computed only for functions/methods, not classes | McCabe applies to executable units |

---

## 3. Functional Specifications

### 3.1 MCP Tool: `complexity_analysis`

#### 3.1.1 Input Schema

```json
{
  "name": "complexity_analysis",
  "description": "Analyze cyclomatic complexity of functions with breakdown and grading",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file_path": {
        "type": "string",
        "description": "Analyze all functions in this file"
      },
      "symbol_name": {
        "type": "string",
        "description": "Analyze specific function/method by name"
      },
      "min_complexity": {
        "type": "integer",
        "description": "Filter: minimum CC score to include"
      },
      "grade_filter": {
        "type": "string",
        "description": "Filter by grades, comma-separated (e.g., 'D,F')"
      },
      "module": {
        "type": "string",
        "description": "Filter by module/directory"
      },
      "limit": {
        "type": "integer",
        "default": 20,
        "description": "Max results to return"
      },
      "sort_by": {
        "type": "string",
        "enum": ["complexity", "name", "file"],
        "default": "complexity",
        "description": "Sort order (complexity = desc, name/file = asc)"
      }
    }
  }
}
```

#### 3.1.2 Output Schema

```json
{
  "results": [
    {
      "symbol": "string — function name",
      "file": "string — relative file path",
      "line": "integer — start line",
      "end_line": "integer — end line",
      "complexity": "integer — CC score",
      "grade": "string — A/B/C/D/F",
      "breakdown": {
        "branches": "integer",
        "loops": "integer",
        "logical_ops": "integer",
        "nesting_depth": "integer",
        "early_returns": "integer",
        "exception_handlers": "integer"
      }
    }
  ],
  "summary": {
    "total_functions": "integer",
    "analyzed": "integer",
    "average_complexity": "float",
    "max_complexity": "integer",
    "grade_distribution": {
      "A": "integer",
      "B": "integer",
      "C": "integer",
      "D": "integer",
      "F": "integer"
    }
  }
}
```

#### 3.1.3 Error Responses

| Error | Code | Message |
|-------|------|---------|
| File not found | NOT_FOUND | "File not indexed: {path}" |
| Symbol not found | NOT_FOUND | "Symbol not found: {name}" |
| Language unsupported | UNSUPPORTED | "Language not supported for complexity: {lang}" |
| Parse error | PARSE_ERROR | "Failed to parse: {file}" |

### 3.2 Database Schema

#### complexity table

```sql
CREATE TABLE IF NOT EXISTS complexity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol_id INTEGER NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
  cyclomatic_complexity INTEGER NOT NULL DEFAULT 1,
  branches INTEGER NOT NULL DEFAULT 0,
  loops INTEGER NOT NULL DEFAULT 0,
  logical_ops INTEGER NOT NULL DEFAULT 0,
  nesting_depth INTEGER NOT NULL DEFAULT 0,
  early_returns INTEGER NOT NULL DEFAULT 0,
  exception_handlers INTEGER NOT NULL DEFAULT 0,
  grade TEXT NOT NULL DEFAULT 'A',
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(symbol_id)
);

CREATE INDEX idx_complexity_grade ON complexity(grade);
CREATE INDEX idx_complexity_cc ON complexity(cyclomatic_complexity DESC);
```

### 3.3 Configuration Schema

In `index-config.json`:

```json
{
  "complexity": {
    "enabled": true,
    "compute_on_index": true,
    "thresholds": {
      "A": [1, 5],
      "B": [6, 10],
      "C": [11, 20],
      "D": [21, 35],
      "F": [36, null]
    },
    "exclude_patterns": ["**/test/**", "**/*.test.*", "**/*.spec.*"],
    "max_function_lines": 1000
  }
}
```

### 3.4 AST Node Mapping

#### TypeScript/JavaScript Decision Points

| AST Node Type | Category | CC Increment |
|---------------|----------|-------------|
| if_statement | branches | +1 |
| else_clause (with if) | branches | +1 (elif) |
| switch_case (non-default) | branches | +1 |
| ternary_expression | branches | +1 |
| for_statement | loops | +1 |
| while_statement | loops | +1 |
| do_statement | loops | +1 |
| for_in_statement | loops | +1 |
| binary_expression (&&) | logical_ops | +1 |
| binary_expression (||) | logical_ops | +1 |
| catch_clause | exception_handlers | +1 |
| optional_chain_expression (?.) | logical_ops | +1 |
| nullish_coalescing (??) | logical_ops | +1 |

#### Python Decision Points

| AST Node Type | Category | CC Increment |
|---------------|----------|-------------|
| if_statement | branches | +1 |
| elif_clause | branches | +1 |
| match_case (non-wildcard) | branches | +1 |
| conditional_expression | branches | +1 |
| for_statement | loops | +1 |
| while_statement | loops | +1 |
| boolean_operator (and) | logical_ops | +1 |
| boolean_operator (or) | logical_ops | +1 |
| except_clause | exception_handlers | +1 |
| list_comprehension (if clause) | branches | +1 |

#### Kotlin Decision Points

| AST Node Type | Category | CC Increment |
|---------------|----------|-------------|
| if_expression | branches | +1 |
| when_entry (non-else) | branches | +1 |
| for_statement | loops | +1 |
| while_statement | loops | +1 |
| do_while_statement | loops | +1 |
| conjunction_expression (&&) | logical_ops | +1 |
| disjunction_expression (||) | logical_ops | +1 |
| catch_block | exception_handlers | +1 |
| elvis_expression (?:) | logical_ops | +1 |
| safe_navigation (?.) | logical_ops | +1 |

---

## 4. Integration Requirements

### 4.1 Integration with Symbol Index

- Complexity calculator reads from `symbols` table (function symbols with file_path, start_line, end_line)
- Results written to `complexity` table with FK to symbols.id
- On symbol deletion (file removed/changed), cascade deletes complexity data

### 4.2 Integration with Indexer

- After tree-sitter parse + symbol extraction, trigger complexity calculation
- Complexity computed in same transaction as symbol update
- If complexity calculation fails, symbol extraction still succeeds (non-blocking)

### 4.3 Integration with Other Tools

- `code_symbols` tool can optionally include complexity data (via JOIN)
- `code_context` tool includes complexity in symbol detail view
- `find_hot_paths` (KSA-163) reads complexity grades for enrichment

---

## 5. Non-Functional Requirements

| ID | Category | Requirement | Target | Measurement |
|----|----------|-------------|--------|-------------|
| NFR-01 | Performance | Single function CC calculation | < 5ms | Benchmark test |
| NFR-02 | Performance | File with 100 functions | < 500ms | Benchmark test |
| NFR-03 | Performance | Full workspace (1000 files) | < 60s | During indexing |
| NFR-04 | Accuracy | CC score accuracy | ±1 vs manual | Test corpus validation |
| NFR-05 | Storage | Per-function storage overhead | < 100 bytes | DB size measurement |
| NFR-06 | Availability | Graceful degradation | No crash on unsupported lang | Error handling test |

---

## 6. Open Issues

| # | Issue | Impact | Decision Needed |
|---|-------|--------|-----------------|
| 1 | Should `?.` (optional chaining) count as decision point? | Affects CC scores for modern JS/TS | Recommend: Yes (creates branch) |
| 2 | Should list comprehension `if` clauses count? | Python-specific | Recommend: Yes (it's a filter branch) |
| 3 | Should `default` case in switch count? | Affects switch CC | Recommend: No (it's the else equivalent) |
| 4 | Cognitive complexity as alternative/addition? | Different metric, different use case | Defer to future ticket |

---

## Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence — Complexity Calculation | [sequence-complexity.png](diagrams/sequence-complexity.png) | [sequence-complexity.drawio](diagrams/sequence-complexity.drawio) |
| 3 | State — Complexity Computation | [state-complexity.png](diagrams/state-complexity.png) | [state-complexity.drawio](diagrams/state-complexity.drawio) |
