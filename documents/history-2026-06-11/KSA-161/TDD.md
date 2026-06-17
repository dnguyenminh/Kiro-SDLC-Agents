# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-161: [Quality] Cyclomatic Complexity - AST-based grading A-F

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-161 |
| Title | [Quality] Cyclomatic Complexity - AST-based grading A-F |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-05 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-161.docx |

---

## 1. Architecture Overview

### 1.1 Component Placement

The complexity analyzer is a new module within the `mcp-code-intelligence-nodejs` server, positioned between the tree-sitter parser layer and the MCP tool layer.

```
┌─────────────────────────────────────────────────┐
│ MCP Tool Layer (complexity_analysis tool)        │
├─────────────────────────────────────────────────┤
│ Complexity Analyzer Module (NEW)                 │
│  ├── ComplexityCalculator                        │
│  ├── ASTNodeCounter (per-language)               │
│  ├── GradeAssigner                               │
│  └── ComplexityStore (SQLite)                    │
├─────────────────────────────────────────────────┤
│ Tree-sitter Parser Layer (KSA-145)               │
├─────────────────────────────────────────────────┤
│ SQLite Storage Layer                             │
└─────────────────────────────────────────────────┘
```

### 1.2 Design Principles

- **Single Responsibility**: Each class handles one concern (counting, grading, storing)
- **Strategy Pattern**: Language-specific node counters as interchangeable strategies
- **Lazy Computation**: Complexity computed on-demand or during indexing (configurable)
- **Cache-friendly**: Results stored in DB, invalidated on file change

---

## 2. Module Design

### 2.1 File Structure

```
src/
├── analyzers/
│   └── complexity/
│       ├── index.ts                    # Module exports
│       ├── ComplexityAnalyzer.ts       # Main orchestrator
│       ├── ComplexityCalculator.ts     # Core CC calculation
│       ├── GradeAssigner.ts            # Grade threshold logic
│       ├── ComplexityStore.ts          # SQLite CRUD
│       ├── ComplexityTool.ts           # MCP tool registration
│       └── counters/
│           ├── BaseNodeCounter.ts      # Abstract base
│           ├── TypeScriptCounter.ts    # TS/JS decision points
│           ├── PythonCounter.ts        # Python decision points
│           ├── KotlinCounter.ts        # Kotlin decision points
│           ├── JavaCounter.ts          # Java decision points
│           ├── GoCounter.ts            # Go decision points
│           └── RustCounter.ts          # Rust decision points
```

### 2.2 Class Design

#### ComplexityAnalyzer (Orchestrator)

```typescript
class ComplexityAnalyzer {
  constructor(
    private calculator: ComplexityCalculator,
    private store: ComplexityStore,
    private grader: GradeAssigner
  )

  // Analyze single function
  analyzeFunction(symbolId: number, ast: SyntaxNode): ComplexityResult

  // Analyze all functions in file
  analyzeFile(filePath: string): FileComplexityResult

  // Query stored results with filters
  query(filters: ComplexityFilters): ComplexityQueryResult
}
```

#### ComplexityCalculator

```typescript
class ComplexityCalculator {
  private counters: Map<string, BaseNodeCounter>

  // Register language-specific counter
  registerCounter(language: string, counter: BaseNodeCounter): void

  // Calculate CC for a function body AST node
  calculate(bodyNode: SyntaxNode, language: string): ComplexityBreakdown
}
```

#### BaseNodeCounter (Abstract)

```typescript
abstract class BaseNodeCounter {
  abstract readonly language: string
  abstract readonly branchNodeTypes: string[]
  abstract readonly loopNodeTypes: string[]
  abstract readonly logicalOpTypes: string[]
  abstract readonly exceptionNodeTypes: string[]

  // Count decision points in AST subtree
  countDecisionPoints(node: SyntaxNode): DecisionPointCounts

  // Calculate max nesting depth
  calculateNestingDepth(node: SyntaxNode): number

  // Count early returns
  countEarlyReturns(node: SyntaxNode): number
}
```

#### GradeAssigner

```typescript
class GradeAssigner {
  constructor(private thresholds: GradeThresholds)

  // Assign grade based on CC score
  assignGrade(cc: number): Grade  // 'A' | 'B' | 'C' | 'D' | 'F'

  // Load thresholds from config
  static fromConfig(config: IndexConfig): GradeAssigner
}
```

---

## 3. API Design

### 3.1 MCP Tool Registration

```typescript
server.tool("complexity_analysis", {
  description: "Analyze cyclomatic complexity with breakdown and grading",
  inputSchema: { /* as defined in FSD 3.1.1 */ },
  handler: async (params) => {
    const analyzer = container.get(ComplexityAnalyzer)
    if (params.symbol_name) {
      return analyzer.analyzeFunction(params.symbol_name, params.file_path)
    }
    return analyzer.query({
      filePath: params.file_path,
      minComplexity: params.min_complexity,
      gradeFilter: params.grade_filter?.split(','),
      module: params.module,
      limit: params.limit ?? 20,
      sortBy: params.sort_by ?? 'complexity'
    })
  }
})
```

### 3.2 Internal Interfaces

```typescript
interface ComplexityBreakdown {
  cyclomatic_complexity: number
  branches: number
  loops: number
  logical_ops: number
  nesting_depth: number
  early_returns: number
  exception_handlers: number
}

interface ComplexityResult extends ComplexityBreakdown {
  symbol_id: number
  symbol_name: string
  file_path: string
  start_line: number
  end_line: number
  grade: Grade
}

interface ComplexityFilters {
  filePath?: string
  symbolName?: string
  minComplexity?: number
  gradeFilter?: Grade[]
  module?: string
  limit: number
  sortBy: 'complexity' | 'name' | 'file'
}

type Grade = 'A' | 'B' | 'C' | 'D' | 'F'
```

---

## 4. Database Design

### 4.1 Schema Migration

```sql
-- Migration: add_complexity_table
CREATE TABLE IF NOT EXISTS complexity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol_id INTEGER NOT NULL,
  cyclomatic_complexity INTEGER NOT NULL DEFAULT 1,
  branches INTEGER NOT NULL DEFAULT 0,
  loops INTEGER NOT NULL DEFAULT 0,
  logical_ops INTEGER NOT NULL DEFAULT 0,
  nesting_depth INTEGER NOT NULL DEFAULT 0,
  early_returns INTEGER NOT NULL DEFAULT 0,
  exception_handlers INTEGER NOT NULL DEFAULT 0,
  grade TEXT NOT NULL DEFAULT 'A',
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
  UNIQUE(symbol_id)
);

CREATE INDEX IF NOT EXISTS idx_complexity_grade ON complexity(grade);
CREATE INDEX IF NOT EXISTS idx_complexity_cc ON complexity(cyclomatic_complexity DESC);
CREATE INDEX IF NOT EXISTS idx_complexity_symbol ON complexity(symbol_id);
```

---

## 5. Algorithm Detail

### 5.1 AST Traversal for Decision Points

```typescript
// TypeScriptCounter example
class TypeScriptCounter extends BaseNodeCounter {
  readonly branchNodeTypes = ['if_statement', 'switch_case', 'ternary_expression']
  readonly loopNodeTypes = ['for_statement', 'while_statement', 'do_statement', 'for_in_statement']
  readonly logicalOpTypes = ['&&', '||', '??', '?.']
  readonly exceptionNodeTypes = ['catch_clause']

  countDecisionPoints(node: SyntaxNode): DecisionPointCounts {
    const counts = { branches: 0, loops: 0, logical_ops: 0, exception_handlers: 0 }
    
    this.walkTree(node, (child) => {
      if (this.branchNodeTypes.includes(child.type)) counts.branches++
      else if (this.loopNodeTypes.includes(child.type)) counts.loops++
      else if (child.type === 'binary_expression') {
        const op = child.childForFieldName('operator')?.text
        if (op && this.logicalOpTypes.includes(op)) counts.logical_ops++
      }
      else if (this.exceptionNodeTypes.includes(child.type)) counts.exception_handlers++
    })
    
    return counts
  }

  calculateNestingDepth(node: SyntaxNode): number {
    let maxDepth = 0
    const controlTypes = [...this.branchNodeTypes, ...this.loopNodeTypes]
    
    const walk = (n: SyntaxNode, depth: number) => {
      if (controlTypes.includes(n.type)) {
        depth++
        maxDepth = Math.max(maxDepth, depth)
      }
      for (const child of n.children) walk(child, depth)
    }
    walk(node, 0)
    return maxDepth
  }
}
```

### 5.2 Complexity Calculation Flow

```
Input: function AST node + language
  │
  ├─ 1. Get language-specific counter
  ├─ 2. Count decision points (branches, loops, logical_ops, exceptions)
  ├─ 3. Calculate nesting depth
  ├─ 4. Count early returns
  ├─ 5. CC = 1 + branches + loops + logical_ops + exception_handlers
  ├─ 6. Assign grade from thresholds
  └─ 7. Return ComplexityResult
```

---

## 6. Error Handling

| Scenario | Handling | Recovery |
|----------|----------|----------|
| Unknown language | Log warning, skip function | Return null (not stored) |
| AST parse failure | Log error with file path | Skip function, continue batch |
| DB write failure | Retry once, then log error | Function analyzed but not persisted |
| Config missing thresholds | Use defaults | Log info about default usage |
| Function body > max_lines | Skip with warning | Configurable limit (default 1000) |

---

## 7. Performance Considerations

- **Parser reuse**: Tree-sitter parser instances cached per language
- **Batch processing**: During indexing, process all functions in file in single pass
- **Incremental**: Only recompute for changed files (mtime + hash check)
- **Index on grade**: Fast filtering by grade without full table scan
- **No redundant traversal**: Single AST walk counts all categories simultaneously

---

## 8. Security Considerations

- No user input directly in SQL (parameterized queries for all DB operations)
- Config file validated before use (malformed thresholds rejected)
- No external network calls
- Memory bounded: max function size limit prevents OOM on pathological inputs

---

## 9. Implementation Checklist

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | Create complexity module structure | src/analyzers/complexity/ | 0.5h |
| 2 | Implement BaseNodeCounter abstract class | counters/BaseNodeCounter.ts | 1h |
| 3 | Implement TypeScriptCounter | counters/TypeScriptCounter.ts | 2h |
| 4 | Implement PythonCounter | counters/PythonCounter.ts | 2h |
| 5 | Implement KotlinCounter | counters/KotlinCounter.ts | 2h |
| 6 | Implement Java/Go/Rust counters | counters/*.ts | 3h |
| 7 | Implement ComplexityCalculator | ComplexityCalculator.ts | 1h |
| 8 | Implement GradeAssigner | GradeAssigner.ts | 0.5h |
| 9 | Implement ComplexityStore (SQLite) | ComplexityStore.ts | 1h |
| 10 | Implement ComplexityTool (MCP registration) | ComplexityTool.ts | 1h |
| 11 | Implement ComplexityAnalyzer (orchestrator) | ComplexityAnalyzer.ts | 1h |
| 12 | Add DB migration | migrations/ | 0.5h |
| 13 | Integration with indexer | src/indexer/ | 1h |
| 14 | Unit tests (50 function corpus) | tests/complexity/ | 3h |
| 15 | Integration tests | tests/integration/ | 2h |

**Total estimated effort: ~20h (0.5 week)**

---

## Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
