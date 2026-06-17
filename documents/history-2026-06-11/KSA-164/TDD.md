# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-164: [Security] Control Flow + Data Flow Analysis

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-164 |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-05 |
| Related FSD | FSD-v1-KSA-164.docx |

---

## 1. Architecture Overview

The CFG/DFG/Taint module is the security analysis foundation. It builds control flow graphs from AST, computes data flow (def-use chains), and performs taint propagation to find source-to-sink paths.

```
┌─────────────────────────────────────────────────┐
│ MCP Tools (control_flow_analysis,                │
│            data_flow_analysis, taint_trace)       │
├─────────────────────────────────────────────────┤
│ Security Analysis Module (NEW)                    │
│  ├── CFGBuilder                                  │
│  │   ├── BasicBlock                              │
│  │   ├── CFGEdge                                 │
│  │   └── ControlFlowGraph                        │
│  ├── DataFlowAnalyzer                            │
│  │   ├── DefUseChain                             │
│  │   └── ReachingDefinitions                     │
│  ├── TaintAnalyzer                               │
│  │   ├── TaintState                              │
│  │   ├── TaintPropagator                         │
│  │   └── TaintRegistry (sources/sinks/sanitizers)│
│  └── SecurityTools (MCP registration)            │
├─────────────────────────────────────────────────┤
│ Tree-sitter Parser Layer (KSA-145)               │
└─────────────────────────────────────────────────┘
```

---

## 2. Module Design

### 2.1 File Structure

```
src/
├── analyzers/
│   └── security/
│       ├── index.ts
│       ├── cfg/
│       │   ├── CFGBuilder.ts           # AST → CFG conversion
│       │   ├── BasicBlock.ts           # Block data structure
│       │   ├── CFGEdge.ts              # Edge types
│       │   └── ControlFlowGraph.ts     # Graph container
│       ├── dataflow/
│       │   ├── DataFlowAnalyzer.ts     # Def-use computation
│       │   ├── DefUseChain.ts          # Chain data structure
│       │   └── ReachingDefinitions.ts  # Iterative algorithm
│       ├── taint/
│       │   ├── TaintAnalyzer.ts        # Main taint engine
│       │   ├── TaintState.ts           # Per-variable taint state
│       │   ├── TaintPropagator.ts      # Propagation rules
│       │   └── TaintRegistry.ts        # Source/sink/sanitizer config
│       ├── SecurityTools.ts            # MCP tool registrations
│       └── config/
│           └── taint-config.json       # Default sources/sinks
```

### 2.2 Key Classes

#### CFGBuilder

```typescript
class CFGBuilder {
  // Build CFG from function AST
  build(functionNode: SyntaxNode, language: string): ControlFlowGraph

  // Create basic block from statement sequence
  private createBlock(statements: SyntaxNode[]): BasicBlock

  // Handle branching (if/switch)
  private handleBranch(node: SyntaxNode, currentBlock: BasicBlock): BasicBlock[]

  // Handle loops (for/while)
  private handleLoop(node: SyntaxNode, currentBlock: BasicBlock): BasicBlock

  // Handle exceptions (try/catch)
  private handleException(node: SyntaxNode, currentBlock: BasicBlock): BasicBlock[]
}
```

#### ControlFlowGraph

```typescript
class ControlFlowGraph {
  readonly entry: BasicBlock
  readonly exits: BasicBlock[]
  readonly blocks: BasicBlock[]
  readonly edges: CFGEdge[]

  // Get successors of a block
  getSuccessors(block: BasicBlock): BasicBlock[]

  // Get predecessors of a block
  getPredecessors(block: BasicBlock): BasicBlock[]

  // Topological sort (for dataflow iteration)
  topologicalOrder(): BasicBlock[]

  // Reverse postorder (for reaching definitions)
  reversePostOrder(): BasicBlock[]
}
```

#### BasicBlock

```typescript
class BasicBlock {
  readonly id: number
  readonly type: 'entry' | 'exit' | 'normal' | 'branch' | 'loop-header' | 'catch'
  readonly statements: Statement[]
  readonly startLine: number
  readonly endLine: number

  // Variables defined in this block
  getDefinitions(): VariableDef[]

  // Variables used in this block
  getUses(): VariableUse[]
}
```

#### TaintAnalyzer

```typescript
class TaintAnalyzer {
  constructor(
    private cfgBuilder: CFGBuilder,
    private dataFlowAnalyzer: DataFlowAnalyzer,
    private registry: TaintRegistry
  )

  // Perform taint analysis on a function
  analyze(functionNode: SyntaxNode, language: string, options: TaintOptions): TaintResult

  // Identify taint sources in function
  private identifySources(cfg: ControlFlowGraph, registry: TaintRegistry): TaintSource[]

  // Propagate taint through CFG
  private propagate(cfg: ControlFlowGraph, sources: TaintSource[], dataflow: DataFlowResult): TaintPath[]

  // Check if expression is a sanitizer
  private isSanitizer(expr: SyntaxNode, sinkType: string): boolean
}
```

---

## 3. CFG Construction Details

### 3.1 Edge Types

| Type | Meaning | Created By |
|------|---------|-----------|
| sequential | Normal flow to next block | Statement sequence |
| branch-true | Condition is true | if/switch |
| branch-false | Condition is false | if (else branch) |
| loop-back | Back to loop header | for/while end |
| loop-exit | Exit loop | Loop condition false |
| exception | Exception thrown | try block → catch |
| return | Early return | return statement |

### 3.2 CFG for Common Patterns

**if-else:**
```
[Block 0: pre-if] → [Block 1: condition]
                      ├─ branch-true → [Block 2: then-body] → [Block 4: merge]
                      └─ branch-false → [Block 3: else-body] → [Block 4: merge]
```

**while loop:**
```
[Block 0: pre-loop] → [Block 1: loop-header/condition]
                        ├─ branch-true → [Block 2: loop-body] ─loop-back→ [Block 1]
                        └─ branch-false → [Block 3: post-loop]
```

**try-catch:**
```
[Block 0: pre-try] → [Block 1: try-body]
                      ├─ sequential → [Block 3: post-try]
                      └─ exception → [Block 2: catch-body] → [Block 3: post-try]
```

---

## 4. Data Flow Algorithm

### 4.1 Reaching Definitions (Iterative)

```typescript
class ReachingDefinitions {
  compute(cfg: ControlFlowGraph): Map<BasicBlock, Set<Definition>> {
    const IN = new Map<BasicBlock, Set<Definition>>()
    const OUT = new Map<BasicBlock, Set<Definition>>()

    // Initialize
    for (const block of cfg.blocks) {
      IN.set(block, new Set())
      OUT.set(block, this.gen(block)) // GEN = definitions in block
    }

    // Iterate until fixed point
    let changed = true
    while (changed) {
      changed = false
      for (const block of cfg.reversePostOrder()) {
        // IN[B] = ∪ OUT[P] for all predecessors P
        const newIN = new Set<Definition>()
        for (const pred of cfg.getPredecessors(block)) {
          for (const def of OUT.get(pred)!) newIN.add(def)
        }
        IN.set(block, newIN)

        // OUT[B] = GEN[B] ∪ (IN[B] - KILL[B])
        const newOUT = new Set([...this.gen(block)])
        for (const def of newIN) {
          if (!this.kills(block, def)) newOUT.add(def)
        }

        if (!setsEqual(OUT.get(block)!, newOUT)) {
          OUT.set(block, newOUT)
          changed = true
        }
      }
    }
    return IN
  }
}
```

---

## 5. Taint Propagation Rules

| Rule | Condition | Result |
|------|-----------|--------|
| Assignment | `y = tainted_x` | y is tainted |
| Concatenation | `s = "str" + tainted` | s is tainted |
| Template literal | `` `${tainted}` `` | result is tainted |
| Function arg | `f(tainted)` and f not sanitizer | return value tainted (conservative) |
| Collection add | `list.push(tainted)` | list is tainted |
| Destructure | `{a} = tainted_obj` | a is tainted |
| Sanitizer | `clean = sanitize(tainted)` | clean is NOT tainted |
| Type cast | `n = parseInt(tainted)` | n is NOT tainted (for string injection) |

---

## 6. Performance Considerations

- **On-demand computation**: CFG/DFG not pre-computed during indexing (too expensive)
- **Function size limit**: Skip functions > 500 lines (configurable)
- **Memoization**: Cache CFG for recently analyzed functions (LRU cache, 100 entries)
- **Early termination**: If no taint sources found, skip propagation
- **Bounded iteration**: Reaching definitions converges in O(n²) worst case for n blocks

---

## 7. Implementation Checklist

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | Create module structure | src/analyzers/security/ | 0.5h |
| 2 | Implement BasicBlock + CFGEdge | cfg/BasicBlock.ts, CFGEdge.ts | 1h |
| 3 | Implement ControlFlowGraph | cfg/ControlFlowGraph.ts | 2h |
| 4 | Implement CFGBuilder (if/else) | cfg/CFGBuilder.ts | 4h |
| 5 | CFGBuilder: loops, try/catch, switch | cfg/CFGBuilder.ts | 4h |
| 6 | Implement ReachingDefinitions | dataflow/ReachingDefinitions.ts | 3h |
| 7 | Implement DataFlowAnalyzer | dataflow/DataFlowAnalyzer.ts | 2h |
| 8 | Implement TaintRegistry | taint/TaintRegistry.ts | 1.5h |
| 9 | Implement TaintPropagator | taint/TaintPropagator.ts | 4h |
| 10 | Implement TaintAnalyzer | taint/TaintAnalyzer.ts | 3h |
| 11 | Create taint-config.json | config/taint-config.json | 2h |
| 12 | Register MCP tools | SecurityTools.ts | 2h |
| 13 | Unit tests (CFG) | tests/security/cfg/ | 4h |
| 14 | Unit tests (dataflow) | tests/security/dataflow/ | 3h |
| 15 | Unit tests (taint) | tests/security/taint/ | 4h |
| 16 | Integration tests | tests/integration/ | 3h |

**Total: ~43h (3.5 weeks with testing)**

---

## Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
