# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-163: [Quality] Circular Deps + Related Tests + Hot Paths

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-163 |
| Title | [Quality] Circular Deps + Related Tests + Hot Paths |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-06-05 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-163.docx |

---

## 1. Use Cases

### UC-163-01: Detect Circular Dependencies

**Actor:** AI Agent / Developer

**Main Flow:**
1. User calls `find_circular_deps` tool
2. System loads dependency graph from relationships table (type=IMPORTS)
3. System runs Tarjan's SCC algorithm to find strongly connected components
4. Each SCC with >1 node represents a circular dependency
5. For each cycle: extract chain, compute length, determine severity
6. Return all cycles sorted by severity then length

**Alternative Flows:**
- 2a. Module filter specified → only load subgraph for that module
- 4a. No cycles found → return empty results with "No circular dependencies"

### UC-163-02: Find Related Tests

**Actor:** AI Agent / Developer

**Main Flow:**
1. User calls `find_related_tests` with `symbol_name`
2. System resolves symbol to symbol_id
3. System performs reverse BFS on call graph (find all callers transitively)
4. System filters callers to only those in test files
5. For each test caller: determine if direct (depth=1) or indirect (depth>1)
6. Return direct tests + indirect tests with call chains

**Alternative Flows:**
- 2a. Multiple symbols with same name → use file_path to disambiguate
- 3a. No callers found → return empty (function has no test coverage)
- 4a. Test file detection: match patterns `*.test.*`, `*.spec.*`, `test_*`, `*_test.*`

### UC-163-03: Analyze Hot Paths

**Actor:** Tech Lead / AI Agent

**Main Flow:**
1. User calls `find_hot_paths` tool
2. System computes transitive caller count for all functions
3. System sorts by caller count (descending)
4. System enriches with complexity grade (if KSA-161 available)
5. Return top-N hottest functions with metrics

### UC-163-04: Detect Dead Imports

**Actor:** Developer / AI Agent

**Main Flow:**
1. User calls `find_dead_imports` with optional file_path
2. System loads import statements from dependency graph
3. For each import: check if imported symbol is referenced in file body
4. If no reference found → mark as dead import
5. Assign confidence: High (definitely unused), Medium (might be used dynamically)
6. Return dead imports with file, line, symbol, confidence

### UC-163-05: Generate Module Summary

**Actor:** Developer / AI Agent

**Main Flow:**
1. User calls `module_summary` with optional module filter
2. System aggregates from symbols table: file count, function count, class count
3. System computes language breakdown from file extensions
4. System includes complexity averages (if available)
5. System includes entry point count (if available)
6. Return structured summary

---

## 2. Business Rules

| ID | Rule | Rationale |
|----|------|-----------|
| BR-163-01 | Circular deps only at file/module level (not function level) | Meaningful architectural metric |
| BR-163-02 | External dependencies (node_modules, vendor) excluded from circular dep check | Only user code matters |
| BR-163-03 | Test file identification uses multiple heuristics (path + naming + decorators) | Maximize recall |
| BR-163-04 | Related test max depth = 5 (configurable) | Prevent infinite traversal |
| BR-163-05 | Hot path score = unique transitive callers (not call count) | Measures blast radius |
| BR-163-06 | Dead import confidence: High if no AST reference, Medium if dynamic import possible | Reduce false positives |
| BR-163-07 | Type-only imports (TypeScript `import type`) not flagged as dead | They're used at compile time |
| BR-163-08 | Re-exports not flagged as dead imports | They're used by consumers |

---

## 3. Functional Specifications

### 3.1 MCP Tool: `find_circular_deps`

#### Input Schema
```json
{
  "name": "find_circular_deps",
  "inputSchema": {
    "type": "object",
    "properties": {
      "module": {"type": "string", "description": "Check specific module/directory only"},
      "max_length": {"type": "integer", "default": 10, "description": "Max cycle length to report"},
      "severity_filter": {"type": "string", "enum": ["High", "Medium", "All"], "default": "All"}
    }
  }
}
```

#### Output Schema
```json
{
  "cycles": [
    {
      "id": "integer",
      "chain": ["file_a.ts", "file_b.ts", "file_a.ts"],
      "length": 2,
      "severity": "High",
      "imports": [
        {"from": "file_a.ts", "to": "file_b.ts", "line": 5, "symbol": "UserService"},
        {"from": "file_b.ts", "to": "file_a.ts", "line": 3, "symbol": "AuthHelper"}
      ]
    }
  ],
  "summary": {"total_cycles": 3, "high_severity": 1, "medium_severity": 2}
}
```

### 3.2 MCP Tool: `find_related_tests`

#### Input Schema
```json
{
  "name": "find_related_tests",
  "inputSchema": {
    "type": "object",
    "required": ["symbol_name"],
    "properties": {
      "symbol_name": {"type": "string", "description": "Function/method to find tests for"},
      "file_path": {"type": "string", "description": "Disambiguate symbol"},
      "max_depth": {"type": "integer", "default": 5, "description": "Max call chain depth"},
      "include_indirect": {"type": "boolean", "default": true}
    }
  }
}
```

#### Output Schema
```json
{
  "target": {"name": "processPayment", "file": "src/payment.ts", "line": 42},
  "direct_tests": [
    {"name": "test_process_payment", "file": "tests/test_payment.py", "line": 10, "framework": "pytest"}
  ],
  "indirect_tests": [
    {"name": "test_checkout", "file": "tests/test_checkout.py", "line": 5, "chain": ["checkout", "processPayment"], "depth": 2}
  ],
  "summary": {"direct_count": 3, "indirect_count": 7, "max_depth_reached": false}
}
```

### 3.3 MCP Tool: `find_hot_paths`

#### Input Schema
```json
{
  "name": "find_hot_paths",
  "inputSchema": {
    "type": "object",
    "properties": {
      "limit": {"type": "integer", "default": 20},
      "min_callers": {"type": "integer", "description": "Minimum transitive caller count"},
      "module": {"type": "string"},
      "include_complexity": {"type": "boolean", "default": true}
    }
  }
}
```

#### Output Schema
```json
{
  "hot_paths": [
    {
      "symbol": "validateInput",
      "file": "src/utils/validation.ts",
      "line": 15,
      "transitive_callers": 45,
      "direct_callers": 12,
      "entry_points_reaching": 8,
      "complexity_grade": "B",
      "complexity_score": 7
    }
  ],
  "summary": {"total_functions": 500, "avg_callers": 3.2, "max_callers": 45}
}
```

### 3.4 MCP Tool: `find_dead_imports`

#### Input Schema
```json
{
  "name": "find_dead_imports",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file_path": {"type": "string"},
      "module": {"type": "string"},
      "confidence": {"type": "string", "enum": ["High", "Medium", "All"], "default": "All"}
    }
  }
}
```

### 3.5 MCP Tool: `module_summary`

#### Input Schema
```json
{
  "name": "module_summary",
  "inputSchema": {
    "type": "object",
    "properties": {
      "module": {"type": "string", "description": "Specific module (default: workspace overview)"},
      "include_details": {"type": "boolean", "default": false, "description": "Include per-file breakdown"}
    }
  }
}
```

---

## 4. Algorithm Specifications

### 4.1 Circular Dependency Detection — Tarjan's SCC

```pseudocode
function findCircularDeps(graph):
  sccs = tarjanSCC(graph)  // O(V+E)
  cycles = []
  for scc in sccs:
    if scc.size > 1:
      // Extract actual import chain
      chain = extractCycleChain(scc, graph)
      severity = "High" if chain.length == 2 else "Medium"
      cycles.append({chain, severity, imports: getImportDetails(chain)})
  return cycles sorted by severity, length
```

### 4.2 Related Test Discovery — Reverse BFS

```pseudocode
function findRelatedTests(symbolId, maxDepth):
  visited = Set()
  queue = [(symbolId, 0, [])]  // (node, depth, path)
  directTests = []
  indirectTests = []
  
  while queue not empty:
    (current, depth, path) = queue.dequeue()
    if depth > maxDepth: continue
    if current in visited: continue
    visited.add(current)
    
    callers = getCallers(current)  // from call graph
    for caller in callers:
      newPath = path + [caller.name]
      if isTestFunction(caller):
        if depth == 0:
          directTests.append(caller)
        else:
          indirectTests.append({caller, chain: newPath, depth: depth+1})
      else:
        queue.enqueue((caller.id, depth+1, newPath))
  
  return {directTests, indirectTests}
```

### 4.3 Hot Path Analysis — Transitive Caller Count

```pseudocode
function computeHotPaths(limit):
  results = []
  for each function F in symbols:
    transitiveCallers = BFS_reverse(F.id, callGraph)
    directCallers = getDirectCallers(F.id)
    entryPoints = filter(transitiveCallers, isEntryPoint)
    results.append({F, transitiveCallers.size, directCallers.size, entryPoints.size})
  
  return results.sortBy(transitiveCallers.size, DESC).take(limit)
```

---

## 5. Integration Requirements

### 5.1 Dependency on KSA-155 (Dependency Graph)
- Reads `relationships` table where `type = 'IMPORTS'`
- Expects: source_id, target_id, file_path, line columns

### 5.2 Dependency on KSA-154 (Call Graph)
- Reads `relationships` table where `type = 'CALLS'`
- Expects: caller_id, callee_id columns

### 5.3 Optional Integration with KSA-161 (Complexity)
- If complexity table exists, JOIN for grade enrichment
- If not available, omit complexity fields from output

---

## 6. Non-Functional Requirements

| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-01 | Performance | Circular dep detection | < 1s (1000 files) |
| NFR-02 | Performance | Related test discovery | < 500ms per query |
| NFR-03 | Performance | Hot path computation | < 2s (5000 functions) |
| NFR-04 | Performance | Dead import detection | < 100ms per file |
| NFR-05 | Accuracy | Circular deps: zero false positives | Only real cycles |
| NFR-06 | Accuracy | Related tests: >= 90% recall | vs manual identification |

---

## Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence — Circular Dep Detection | [sequence-circular.png](diagrams/sequence-circular.png) | [sequence-circular.drawio](diagrams/sequence-circular.drawio) |
| 3 | State — Graph Analysis | [state-analysis.png](diagrams/state-analysis.png) | [state-analysis.drawio](diagrams/state-analysis.drawio) |
