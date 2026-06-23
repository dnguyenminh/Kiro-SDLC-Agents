# Software Test Cases (STC)

## MCP Code Intelligence — KSA-173: [Kotlin] Graph Engine

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-173 |
| Title | [Kotlin] Graph Engine — Test Cases |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-05-26 |
| Status | Draft |
| Related STP | STP-v1-KSA-173.docx |

---

## 1. Property-Based Test Cases (PBT)

### PBT-01: No Dangling Edges

| Field | Value |
|-------|-------|
| ID | PBT-01 |
| Title | Call graph has no dangling edges |
| Level | PBT |
| Priority | P0 |
| Technique | Kotest Property |

**Property:** For every edge in the call graph, both source and target node IDs exist in the graph's node set.

**Generator:** Random AST generator producing 5-50 functions with 0-10 call expressions each.

**Test Code:**
```kotlin
@Test
fun `call graph has no dangling edges`() = forAll(randomProjectGen(files=5..50, callsPerFn=0..10)) { project ->
    val graph = callGraphBuilder.build(project)
    graph.edges.all { edge ->
        graph.containsNode(edge.source) && graph.containsNode(edge.target)
    }
}
```

---

### PBT-06: BFS Visits All Reachable Nodes Exactly Once

| Field | Value |
|-------|-------|
| ID | PBT-06 |
| Level | PBT |
| Priority | P0 |

**Property:** BFS from any start node visits every reachable node exactly once (no duplicates, no missed nodes).

**Generator:** Random directed graph with 10-100 nodes, 5-200 edges.

**Test Code:**
```kotlin
@Test
fun `BFS visits all reachable exactly once`() = forAll(randomGraphGen(nodes=10..100, edges=5..200)) { (graph, startNode) ->
    val result = BfsTraversal(graph).traverse(startNode)
    val visitedSet = result.results.map { it.node }.toSet()
    val reachable = computeReachable(graph, startNode) // ground truth via DFS
    visitedSet == reachable && result.results.size == visitedSet.size
}
```

---

### PBT-09: SCC Mutual Reachability

| Field | Value |
|-------|-------|
| ID | PBT-09 |
| Level | PBT |
| Priority | P0 |

**Property:** Every node in a strongly connected component can reach every other node in the same SCC.

**Generator:** Random directed graph with known SCCs.

---

## 2. Unit Test Cases (UT)

### UT-01: Direct Function Call Creates Edge

| Field | Value |
|-------|-------|
| ID | UT-01 |
| Title | Direct function call creates edge |
| Level | UT |
| Priority | P0 |
| Component | CallGraphBuilder |

**Preconditions:** Parser returns AST with call expression `b()` inside function `a()`

**Steps:**
1. Create mock SymbolTable with functions `a` and `b`
2. Create mock AST with `a` containing call to `b`
3. Call `callGraphBuilder.extractCallEdges(file, ast, symbols)`
4. Verify edge exists from `file::a` to `file::b`

**Expected:** Edge with source=`file::a`, target=`file::b`, type=CALL, confidence=1.0

**Test Data:** `testdata/ut-01-direct-call.csv`

---

### UT-05: Virtual Method Creates Edges to All Implementations

| Field | Value |
|-------|-------|
| ID | UT-05 |
| Title | Virtual method call creates edges to all implementations |
| Level | UT |
| Priority | P0 |
| Component | CallResolver |

**Preconditions:** Interface `Processor` with method `process()`, implemented by `FooProcessor` and `BarProcessor`

**Steps:**
1. Create symbol table with interface + 2 implementations
2. Create AST with call `processor.process()`
3. Call resolver with virtual call
4. Verify edges to both implementations

**Expected:** 2 edges with confidence=0.7, type=CALL, callType=VIRTUAL

---

### UT-21: BFS Level-Order Traversal

| Field | Value |
|-------|-------|
| ID | UT-21 |
| Title | BFS visits nodes in level-order |
| Level | UT |
| Priority | P0 |
| Component | BfsTraversal |

**Preconditions:** Graph: A→B, A→C, B→D, C→D

**Steps:**
1. Create graph with 4 nodes and edges as above
2. Call `bfsTraversal.traverse(start="A")`
3. Verify visit order

**Expected:** Visit order: A(depth=0), B(depth=1), C(depth=1), D(depth=2)

---

### UT-29: Self-Recursion Detected

| Field | Value |
|-------|-------|
| ID | UT-29 |
| Title | Self-recursive function detected as cycle |
| Level | UT |
| Priority | P0 |
| Component | CycleDetector |

**Preconditions:** Graph with single self-loop: A→A

**Steps:**
1. Create graph with node A and edge A→A
2. Call `cycleDetector.detectCycles(graph)`
3. Verify cycle found

**Expected:** 1 cycle with path=[A,A], severity=INFO, type=self_recursion

---

### UT-35: Modified File Updates Edges

| Field | Value |
|-------|-------|
| ID | UT-35 |
| Title | File modification updates graph edges correctly |
| Level | UT |
| Priority | P0 |
| Component | IncrementalUpdater |

**Preconditions:** Graph built with file `a.kt` calling `b()`. File modified to call `c()` instead.

**Steps:**
1. Build initial graph (a→b edge exists)
2. Simulate file change: a.kt now calls c() instead of b()
3. Call `incrementalUpdater.onFileChanged("a.kt", MODIFIED)`
4. Verify old edge removed, new edge added

**Expected:** Edge a→b removed, edge a→c added, generation incremented

---

## 3. Integration Test Cases (IT)

### IT-01: Full Call Graph Build from Parsed Project

| Field | Value |
|-------|-------|
| ID | IT-01 |
| Title | Build complete call graph from multi-file project |
| Level | IT |
| Priority | P0 |
| Components | CallGraphBuilder, CallResolver, DirectedGraph |

**Preconditions:** Test fixture `small-project/` with 10 Kotlin files, known call relationships

**Steps:**
1. Parse all files using mock ParserDataProvider (returns pre-built ASTs)
2. Call `callGraphBuilder.build("testdata/small-project")`
3. Verify node count matches expected (all functions found)
4. Verify edge count matches expected (all calls resolved)
5. Verify no dangling edges
6. Verify cross-file calls resolved correctly

**Expected:**
- Nodes: 35 (all functions in 10 files)
- Edges: 48 (all direct calls + virtual calls)
- Unresolved: < 5% of total calls
- Build time: < 1s

---

### IT-08: Concurrent Read During Update

| Field | Value |
|-------|-------|
| ID | IT-08 |
| Title | Concurrent reads succeed during graph update |
| Level | IT |
| Priority | P1 |
| Components | DirectedGraph, RWLock |

**Preconditions:** Graph built with 1000 nodes

**Steps:**
1. Start 10 concurrent read threads (traversals)
2. Simultaneously trigger incremental update
3. Verify all reads complete without exception
4. Verify no data corruption (consistent results)

**Expected:** All reads succeed, no ConcurrentModificationException, results are consistent snapshots

---

### IT-09: Large Graph Performance

| Field | Value |
|-------|-------|
| ID | IT-09 |
| Title | 1000-file project builds within performance target |
| Level | IT |
| Priority | P0 |
| Components | Full pipeline |

**Preconditions:** Test fixture `large-project/` with 1000 files

**Steps:**
1. Build call graph for large-project
2. Measure build time
3. Build dependency graph
4. Measure build time
5. Run impact analysis on 10 random nodes
6. Measure average query time

**Expected:**
- Call graph build: < 10s
- Dependency graph build: < 5s
- Impact analysis: < 500ms average

---

## 4. E2E API Test Cases (E2E-API)

### E2E-API-01: Build Call Graph via MCP

| Field | Value |
|-------|-------|
| ID | E2E-API-01 |
| Title | Build call graph via MCP tool call |
| Level | E2E-API |
| Priority | P0 |

**Request:**
```json
{
  "tool": "graph_build",
  "arguments": { "path": "testdata/small-project", "type": "call" }
}
```

**Expected Response:**
```json
{
  "status": "success",
  "graph_type": "call",
  "nodes": 35,
  "edges": 48,
  "build_time_ms": "<1000"
}
```

---

### E2E-API-13: Error — Graph Not Built

| Field | Value |
|-------|-------|
| ID | E2E-API-13 |
| Title | Query before build returns GRAPH_001 error |
| Level | E2E-API |
| Priority | P0 |

**Request:**
```json
{
  "tool": "graph_traverse",
  "arguments": { "start": "main::foo", "algorithm": "bfs" }
}
```

**Expected Response:**
```json
{
  "error": "GRAPH_001",
  "message": "Graph not initialized. Call graph_build first."
}
```

---

## 5. System Integration Test Cases (SIT)

### SIT-01: Kotlin Call Graph Matches nodejs

| Field | Value |
|-------|-------|
| ID | SIT-01 |
| Title | Kotlin call graph output matches nodejs v2 for same input |
| Level | SIT |
| Priority | P0 |
| Automation | Automated |

**Steps:**
1. Run nodejs v2 graph_build on `nodejs-fixtures/project-a/`
2. Run Kotlin graph_build on same fixture
3. Normalize both outputs (sort nodes/edges by ID)
4. JSON diff comparison

**Expected:** < 1% difference (only acceptable: node ID format differences if documented)

---

### SIT-08: Visual Inspection of Large Graph

| Field | Value |
|-------|-------|
| ID | SIT-08 |
| Title | Manual spot-check of large graph output |
| Level | SIT |
| Priority | P2 |
| Automation | Manual |

**Steps:**
1. Build graph for large-project fixture
2. Export graph stats
3. Randomly select 10 nodes
4. Verify each node's edges make sense (caller actually calls callee in source)
5. Verify no obviously wrong edges

**Expected:** All 10 spot-checked nodes have correct edges

---

## 6. Test Data Files

| File | Description | Used By |
|------|-------------|---------|
| testdata/ut-01-direct-call.csv | Direct call test data | UT-01 |
| testdata/ut-05-virtual-call.csv | Virtual method test data | UT-05 |
| testdata/small-project/ | 10-file Kotlin project | IT-01..IT-06 |
| testdata/medium-project/ | 100-file project | IT-09 |
| testdata/large-project/ | 1000-file project | IT-09, IT-10 |
| testdata/cyclic-project/ | Project with known cycles | UT-29..34, E2E-API-07..09 |
| testdata/nodejs-fixtures/ | Shared fixtures from KSA-144 | SIT-01..SIT-07 |

---

## 7. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage Overview | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |
