# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-163: [Quality] Circular Deps + Related Tests + Hot Paths

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-163 |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-05 |
| Related FSD | FSD-v1-KSA-163.docx |

---

## 1. Architecture Overview

This module provides graph analysis tools that operate on the dependency graph (KSA-155) and call graph (KSA-154). It implements standard graph algorithms (Tarjan's SCC, BFS, transitive closure) on the existing relationships table.

```
┌─────────────────────────────────────────────────┐
│ MCP Tools (find_circular_deps, find_related_tests, │
│            find_hot_paths, find_dead_imports,      │
│            module_summary)                         │
├─────────────────────────────────────────────────┤
│ Graph Analysis Module (NEW)                       │
│  ├── CircularDepDetector (Tarjan's SCC)          │
│  ├── RelatedTestFinder (Reverse BFS)             │
│  ├── HotPathAnalyzer (Transitive callers)        │
│  ├── DeadImportDetector (Reference check)        │
│  └── ModuleSummarizer (Aggregation)              │
├─────────────────────────────────────────────────┤
│ Graph Data Layer (KSA-153 relationships table)    │
└─────────────────────────────────────────────────┘
```

---

## 2. Module Design

### 2.1 File Structure

```
src/
├── analyzers/
│   └── graph-analysis/
│       ├── index.ts
│       ├── CircularDepDetector.ts
│       ├── RelatedTestFinder.ts
│       ├── HotPathAnalyzer.ts
│       ├── DeadImportDetector.ts
│       ├── ModuleSummarizer.ts
│       ├── GraphAnalysisTools.ts    # MCP tool registrations
│       └── utils/
│           ├── GraphLoader.ts       # Load subgraph from DB
│           ├── TarjanSCC.ts         # Tarjan's algorithm
│           └── TestFileDetector.ts  # Test file heuristics
```

### 2.2 Key Classes

#### CircularDepDetector

```typescript
class CircularDepDetector {
  constructor(private graphLoader: GraphLoader)

  // Find all circular dependencies
  detect(options: { module?: string, maxLength?: number }): CircularDep[]

  // Internal: Tarjan's SCC
  private findSCCs(graph: AdjacencyList): StronglyConnectedComponent[]

  // Extract human-readable cycle chain from SCC
  private extractCycleChain(scc: SCC, graph: AdjacencyList): CycleChain
}
```

#### RelatedTestFinder

```typescript
class RelatedTestFinder {
  constructor(
    private graphLoader: GraphLoader,
    private testDetector: TestFileDetector
  )

  // Find tests related to a symbol
  find(symbolId: number, options: { maxDepth?: number, includeIndirect?: boolean }): RelatedTestResult

  // Reverse BFS on call graph
  private reverseBFS(startId: number, maxDepth: number): CallerPath[]
}
```

#### HotPathAnalyzer

```typescript
class HotPathAnalyzer {
  constructor(private graphLoader: GraphLoader)

  // Compute hot paths (most-called functions)
  analyze(options: { limit?: number, minCallers?: number, module?: string }): HotPath[]

  // Compute transitive caller count for a function
  private computeTransitiveCallers(symbolId: number): number
}
```

---

## 3. Algorithm Implementations

### 3.1 Tarjan's SCC (Circular Deps)

```typescript
class TarjanSCC {
  private index = 0
  private stack: number[] = []
  private indices: Map<number, number> = new Map()
  private lowlinks: Map<number, number> = new Map()
  private onStack: Set<number> = new Set()
  private sccs: number[][] = []

  findSCCs(graph: Map<number, number[]>): number[][] {
    for (const node of graph.keys()) {
      if (!this.indices.has(node)) {
        this.strongConnect(node, graph)
      }
    }
    return this.sccs.filter(scc => scc.length > 1) // Only cycles
  }

  private strongConnect(v: number, graph: Map<number, number[]>): void {
    this.indices.set(v, this.index)
    this.lowlinks.set(v, this.index)
    this.index++
    this.stack.push(v)
    this.onStack.add(v)

    for (const w of (graph.get(v) || [])) {
      if (!this.indices.has(w)) {
        this.strongConnect(w, graph)
        this.lowlinks.set(v, Math.min(this.lowlinks.get(v)!, this.lowlinks.get(w)!))
      } else if (this.onStack.has(w)) {
        this.lowlinks.set(v, Math.min(this.lowlinks.get(v)!, this.indices.get(w)!))
      }
    }

    if (this.lowlinks.get(v) === this.indices.get(v)) {
      const scc: number[] = []
      let w: number
      do {
        w = this.stack.pop()!
        this.onStack.delete(w)
        scc.push(w)
      } while (w !== v)
      this.sccs.push(scc)
    }
  }
}
```

### 3.2 Reverse BFS (Related Tests)

```typescript
function reverseBFS(startId: number, callGraph: Map<number, number[]>, maxDepth: number): CallerPath[] {
  const visited = new Set<number>()
  const queue: Array<{id: number, depth: number, path: number[]}> = [{id: startId, depth: 0, path: []}]
  const results: CallerPath[] = []

  while (queue.length > 0) {
    const {id, depth, path} = queue.shift()!
    if (depth > maxDepth || visited.has(id)) continue
    visited.add(id)

    const callers = callGraph.get(id) || [] // reverse edges
    for (const caller of callers) {
      const newPath = [...path, caller]
      results.push({symbolId: caller, depth: depth + 1, path: newPath})
      queue.push({id: caller, depth: depth + 1, path: newPath})
    }
  }
  return results
}
```

### 3.3 Test File Detection Heuristics

```typescript
class TestFileDetector {
  private testPatterns = [
    /\.test\.[jt]sx?$/,
    /\.spec\.[jt]sx?$/,
    /_test\.(py|go|rs)$/,
    /test_.*\.py$/,
    /Test\.java$/,
    /Test\.kt$/
  ]
  private testDirs = ['__tests__', 'tests', 'test', 'spec']

  isTestFile(filePath: string): boolean {
    return this.testPatterns.some(p => p.test(filePath)) ||
           this.testDirs.some(d => filePath.includes(`/${d}/`))
  }

  isTestFunction(symbolName: string, decorators: string[]): boolean {
    return symbolName.startsWith('test_') ||
           symbolName.startsWith('Test') ||
           decorators.some(d => ['@Test', '@pytest.mark', 'it(', 'describe('].some(t => d.includes(t)))
  }
}
```

---

## 4. Database Queries

### 4.1 Load Dependency Graph

```sql
SELECT source_id, target_id, source_file, target_file, line
FROM relationships
WHERE type = 'IMPORTS'
  AND source_file NOT LIKE '%node_modules%'
  AND source_file NOT LIKE '%vendor%'
```

### 4.2 Load Call Graph (Reverse)

```sql
SELECT target_id AS callee, source_id AS caller
FROM relationships
WHERE type = 'CALLS'
```

### 4.3 Dead Import Check

```sql
-- For each import, check if imported symbol is referenced
SELECT r.id, r.source_file, r.line, r.target_symbol_name
FROM relationships r
WHERE r.type = 'IMPORTS'
  AND r.source_file = ?
  AND NOT EXISTS (
    SELECT 1 FROM symbol_references sr
    WHERE sr.file_path = r.source_file
      AND sr.symbol_name = r.target_symbol_name
      AND sr.line != r.line
  )
```

---

## 5. Performance Optimization

- **Graph caching**: Load full graph once, cache in memory for duration of analysis
- **Lazy loading**: Only load subgraph for specific module when filtered
- **Incremental**: Track which files changed, only recompute affected portions
- **Bounded BFS**: maxDepth parameter prevents unbounded traversal
- **Pre-computed hot paths**: Cache transitive caller counts, invalidate on graph change

---

## 6. Implementation Checklist

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | Create module structure | src/analyzers/graph-analysis/ | 0.5h |
| 2 | Implement GraphLoader | utils/GraphLoader.ts | 1.5h |
| 3 | Implement TarjanSCC | utils/TarjanSCC.ts | 2h |
| 4 | Implement CircularDepDetector | CircularDepDetector.ts | 2h |
| 5 | Implement TestFileDetector | utils/TestFileDetector.ts | 1h |
| 6 | Implement RelatedTestFinder | RelatedTestFinder.ts | 2h |
| 7 | Implement HotPathAnalyzer | HotPathAnalyzer.ts | 2h |
| 8 | Implement DeadImportDetector | DeadImportDetector.ts | 1.5h |
| 9 | Implement ModuleSummarizer | ModuleSummarizer.ts | 1h |
| 10 | Register MCP tools | GraphAnalysisTools.ts | 1.5h |
| 11 | Unit tests | tests/graph-analysis/ | 3h |
| 12 | Integration tests | tests/integration/ | 2h |

**Total: ~20h (0.5 week)**

---

## Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
