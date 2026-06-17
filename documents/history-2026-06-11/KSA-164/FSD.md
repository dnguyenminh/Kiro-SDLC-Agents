# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-164: [Security] Control Flow + Data Flow Analysis

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-164 |
| Title | [Security] Control Flow + Data Flow Analysis |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-06-05 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-164.docx |

---

## 1. Use Cases

### UC-164-01: Build CFG for Function

**Actor:** System / AI Agent

**Main Flow:**
1. User calls `control_flow_analysis` with symbol_name/file_path
2. System retrieves function AST from tree-sitter
3. CFG builder creates entry block
4. Builder walks AST statements sequentially, creating blocks
5. At branch points (if/switch/loop): create successor blocks with typed edges
6. At function end: create exit block
7. Return CFG structure (blocks + edges)

**Alternative Flows:**
- 2a. Function not found → error
- 4a. Empty function → single block (entry=exit)
- 5a. Unreachable code after return → create block but mark as unreachable

### UC-164-02: Compute Data Flow (Def-Use Chains)

**Actor:** System / AI Agent

**Main Flow:**
1. User calls `data_flow_analysis` with symbol_name
2. System builds CFG (UC-164-01)
3. For each block, identify variable definitions (assignments, params)
4. For each block, identify variable uses (reads)
5. Compute reaching definitions using iterative dataflow algorithm
6. Build def-use chains linking each use to its reaching definitions
7. Return def-use chains per variable

### UC-164-03: Perform Taint Trace

**Actor:** Security Engineer / AI Agent

**Main Flow:**
1. User calls `taint_trace` with file_path/symbol_name
2. System builds CFG + computes data flow
3. System identifies taint sources in function (from registry)
4. For each source: mark variable as tainted
5. Propagate taint through CFG following data flow:
   - Assignment from tainted → target is tainted
   - Concatenation with tainted → result is tainted
   - Function call with tainted arg → check if function is sanitizer
6. At each sink: check if reaching data is tainted
7. If tainted data reaches sink without sanitizer → report finding
8. Return findings with source→sink paths

**Alternative Flows:**
- 3a. No sources found in function → return empty (no taint entry points)
- 5a. Sanitizer encountered → remove taint from that path
- 6a. Sink reached with sanitized data → no finding (safe)

**Exception Flows:**
- E1. Recursive/complex CFG → limit analysis depth, report partial results
- E2. Unknown function call with tainted arg → conservative: assume taint propagates

---

## 2. Business Rules

| ID | Rule | Rationale |
|----|------|-----------|
| BR-164-01 | CFG has exactly one entry node and one or more exit nodes | Standard CFG definition |
| BR-164-02 | Each basic block has no internal branches | Definition of basic block |
| BR-164-03 | Back-edges (loops) identified separately from forward edges | Needed for loop analysis |
| BR-164-04 | Taint propagates through assignment (y = tainted_x → y is tainted) | Standard taint semantics |
| BR-164-05 | String concatenation with tainted data → result is tainted | Injection vector |
| BR-164-06 | Sanitizer removes taint only for the specific vulnerability type it addresses | escape_html removes XSS taint, not SQL taint |
| BR-164-07 | Function parameters from HTTP handlers are taint sources | Entry point data is untrusted |
| BR-164-08 | Type casting (int(), parseInt()) removes string-based taint | Type conversion sanitizes |
| BR-164-09 | Conservative: unknown function with tainted arg → taint propagates | Avoid false negatives |
| BR-164-10 | Scope: intra-procedural only (single function) for MVP | Performance + complexity |

---

## 3. Functional Specifications

### 3.1 MCP Tool: `control_flow_analysis`

#### Input Schema
```json
{
  "name": "control_flow_analysis",
  "inputSchema": {
    "type": "object",
    "required": ["symbol_name"],
    "properties": {
      "symbol_name": {"type": "string", "description": "Function to analyze"},
      "file_path": {"type": "string", "description": "Disambiguate symbol"},
      "include_unreachable": {"type": "boolean", "default": false}
    }
  }
}
```

#### Output Schema
```json
{
  "function": {"name": "processRequest", "file": "src/handler.py", "line": 10},
  "cfg": {
    "blocks": [
      {
        "id": 0,
        "type": "entry",
        "statements": [{"type": "assignment", "line": 11, "text": "data = request.json"}],
        "start_line": 11,
        "end_line": 12
      },
      {
        "id": 1,
        "type": "branch",
        "statements": [{"type": "if", "line": 13, "condition": "data.get('admin')"}],
        "start_line": 13,
        "end_line": 13
      }
    ],
    "edges": [
      {"from": 0, "to": 1, "type": "sequential"},
      {"from": 1, "to": 2, "type": "branch-true"},
      {"from": 1, "to": 3, "type": "branch-false"}
    ],
    "entry": 0,
    "exits": [4, 5]
  },
  "metrics": {
    "blocks": 6,
    "edges": 8,
    "paths": 4,
    "cyclomatic_complexity": 3
  }
}
```

### 3.2 MCP Tool: `data_flow_analysis`

#### Input Schema
```json
{
  "name": "data_flow_analysis",
  "inputSchema": {
    "type": "object",
    "required": ["symbol_name"],
    "properties": {
      "symbol_name": {"type": "string"},
      "file_path": {"type": "string"},
      "variable": {"type": "string", "description": "Specific variable to trace (optional)"}
    }
  }
}
```

#### Output Schema
```json
{
  "function": {"name": "processRequest", "file": "src/handler.py"},
  "variables": [
    {
      "name": "user_input",
      "definitions": [
        {"line": 5, "block": 0, "expression": "request.args.get('q')", "is_taint_source": true}
      ],
      "uses": [
        {"line": 10, "block": 2, "context": "cursor.execute(query)", "is_sink": true},
        {"line": 8, "block": 1, "context": "query = 'SELECT * FROM t WHERE x=' + user_input", "is_concat": true}
      ],
      "reaching_definitions": {
        "line_10": [{"def_line": 5, "path": [0, 1, 2]}]
      }
    }
  ]
}
```

### 3.3 MCP Tool: `taint_trace`

#### Input Schema
```json
{
  "name": "taint_trace",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file_path": {"type": "string"},
      "symbol_name": {"type": "string"},
      "source_type": {"type": "string", "enum": ["http", "env", "file", "db", "user_input", "all"], "default": "all"},
      "sink_type": {"type": "string", "enum": ["sql", "shell", "fs", "html", "eval", "all"], "default": "all"},
      "include_sanitized": {"type": "boolean", "default": false}
    }
  }
}
```

#### Output Schema
```json
{
  "findings": [
    {
      "id": "TAINT-001",
      "source": {"line": 5, "expression": "request.args.get('q')", "type": "http"},
      "sink": {"line": 12, "expression": "cursor.execute(query)", "type": "sql"},
      "path": [5, 8, 10, 12],
      "taint_chain": [
        {"line": 5, "var": "user_input", "action": "source"},
        {"line": 8, "var": "query", "action": "propagate_concat"},
        {"line": 12, "var": "query", "action": "sink"}
      ],
      "sanitized": false,
      "vulnerability_type": "sql_injection",
      "confidence": "High"
    }
  ],
  "summary": {
    "sources_found": 3,
    "sinks_found": 2,
    "taint_paths": 1,
    "sanitized_paths": 1
  }
}
```

### 3.4 Taint Configuration Schema

File: `taint-config.json`

```json
{
  "sources": {
    "http": [
      {"language": "python", "patterns": ["request.args.*", "request.form.*", "request.json.*", "request.data"]},
      {"language": "typescript", "patterns": ["req.body.*", "req.query.*", "req.params.*", "ctx.request.body"]},
      {"language": "java", "patterns": ["request.getParameter(*)", "request.getAttribute(*)"]}
    ],
    "env": [
      {"language": "python", "patterns": ["os.environ.*", "os.getenv(*)"]},
      {"language": "typescript", "patterns": ["process.env.*"]}
    ]
  },
  "sinks": {
    "sql": [
      {"language": "python", "patterns": ["cursor.execute(*)", "connection.execute(*)", "db.execute(*)"]},
      {"language": "typescript", "patterns": ["query(*)", "raw(*)", "knex.raw(*)"]}
    ],
    "shell": [
      {"language": "python", "patterns": ["os.system(*)", "subprocess.run(*)", "subprocess.call(*)"]},
      {"language": "typescript", "patterns": ["exec(*)", "execSync(*)", "spawn(*)"]}
    ]
  },
  "sanitizers": {
    "sql": [
      {"language": "*", "patterns": ["parameterized_query", "prepared_statement", "placeholder_?", "placeholder_$"]}
    ],
    "xss": [
      {"language": "python", "patterns": ["escape(*)", "markupsafe.escape(*)", "bleach.clean(*)"]},
      {"language": "typescript", "patterns": ["escapeHtml(*)", "DOMPurify.sanitize(*)", "encodeURIComponent(*)"]}
    ]
  }
}
```

---

## 4. Algorithm Specifications

### 4.1 CFG Construction Algorithm

```pseudocode
function buildCFG(functionAST):
  entry = createBlock(type="entry")
  current = entry
  
  for statement in functionAST.body:
    if statement.type == "if_statement":
      trueBlock = createBlock()
      falseBlock = createBlock()
      mergeBlock = createBlock()
      addEdge(current, trueBlock, "branch-true")
      addEdge(current, falseBlock, "branch-false")
      current = buildCFG_recursive(statement.consequence, trueBlock)
      addEdge(current, mergeBlock, "sequential")
      if statement.alternative:
        current = buildCFG_recursive(statement.alternative, falseBlock)
        addEdge(current, mergeBlock, "sequential")
      else:
        addEdge(falseBlock, mergeBlock, "sequential")
      current = mergeBlock
      
    elif statement.type in ["for_statement", "while_statement"]:
      headerBlock = createBlock()
      bodyBlock = createBlock()
      exitBlock = createBlock()
      addEdge(current, headerBlock, "sequential")
      addEdge(headerBlock, bodyBlock, "branch-true")
      addEdge(headerBlock, exitBlock, "branch-false")
      loopEnd = buildCFG_recursive(statement.body, bodyBlock)
      addEdge(loopEnd, headerBlock, "loop-back")
      current = exitBlock
      
    elif statement.type == "return_statement":
      current.addStatement(statement)
      addEdge(current, exitNode, "return")
      current = createBlock()  // unreachable after return
      
    else:
      current.addStatement(statement)
  
  addEdge(current, exitNode, "sequential")
  return CFG(entry, exitNode, blocks, edges)
```

### 4.2 Reaching Definitions (Iterative Dataflow)

```pseudocode
function computeReachingDefs(cfg):
  // Initialize
  for each block B:
    IN[B] = {}
    OUT[B] = GEN[B]  // definitions generated in B
  
  // Iterate until fixed point
  changed = true
  while changed:
    changed = false
    for each block B in reverse postorder:
      IN[B] = union(OUT[P] for P in predecessors(B))
      newOUT = GEN[B] union (IN[B] - KILL[B])
      if newOUT != OUT[B]:
        OUT[B] = newOUT
        changed = true
  
  return {IN, OUT} for all blocks
```

### 4.3 Taint Propagation

```pseudocode
function propagateTaint(cfg, dataflow, sources, sinks, sanitizers):
  findings = []
  taintState = {}  // variable → {tainted: bool, source: location, path: []}
  
  // Mark initial taint sources
  for source in identifySources(cfg, sources):
    taintState[source.variable] = {tainted: true, source: source.location, path: [source.line]}
  
  // Propagate through CFG in topological order
  for block in topologicalOrder(cfg):
    for statement in block.statements:
      if isAssignment(statement):
        rhs_vars = getVariablesInExpression(statement.rhs)
        if any(taintState[v].tainted for v in rhs_vars):
          // Check if sanitizer
          if isSanitizer(statement.rhs, sanitizers):
            taintState[statement.lhs] = {tainted: false}
          else:
            taintState[statement.lhs] = {tainted: true, source: ..., path: ...}
      
      // Check sinks
      if isSink(statement, sinks):
        args = getSinkArguments(statement)
        for arg in args:
          if taintState[arg].tainted:
            findings.append({source: taintState[arg].source, sink: statement, path: taintState[arg].path})
  
  return findings
```

---

## 5. Integration Requirements

### 5.1 Integration with KSA-145 (Tree-sitter)
- CFG builder receives tree-sitter AST nodes
- Uses node types to identify control structures
- Uses node text to identify variable names and expressions

### 5.2 Integration with KSA-162 (Entry Points)
- HTTP handler parameters automatically marked as taint sources
- Entry point detection provides scan targets for taint analysis

### 5.3 Integration with KSA-165 (Injection Detection)
- KSA-165 uses taint_trace results to classify injection types
- CFG/DFG infrastructure is the foundation for all pattern matching

---

## 6. Non-Functional Requirements

| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-01 | Performance | CFG construction | < 50ms per function |
| NFR-02 | Performance | Data flow analysis | < 100ms per function |
| NFR-03 | Performance | Taint trace | < 200ms per function |
| NFR-04 | Accuracy | False negative rate (direct paths) | 0% |
| NFR-05 | Accuracy | False positive rate | < 20% |
| NFR-06 | Scalability | Functions up to 500 lines | Supported |
| NFR-07 | Configurability | Source/sink/sanitizer registry | JSON config |

---

## 7. Open Issues

| # | Issue | Decision Needed |
|---|-------|-----------------|
| 1 | Inter-procedural analysis scope? | Defer to v2 (intra-proc only for MVP) |
| 2 | Async/await CFG modeling? | Model await as potential branch (exception path) |
| 3 | Generator/yield CFG? | Model as multiple exit/re-entry points |
| 4 | Taint through collections (list.append)? | Conservative: taint the collection |

---

## Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence — Taint Trace | [sequence-taint.png](diagrams/sequence-taint.png) | [sequence-taint.drawio](diagrams/sequence-taint.drawio) |
| 3 | State — Taint Propagation | [state-taint.png](diagrams/state-taint.png) | [state-taint.drawio](diagrams/state-taint.drawio) |
