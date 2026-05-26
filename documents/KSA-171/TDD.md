# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-171: Code Intelligence v2 — Feature Parity Sync (Kotlin + Python)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-171 |
| Title | Code Intelligence v2 — Feature Parity Sync (Kotlin + Python) |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-26 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-171.docx |
| Related FSD | FSD-v1-KSA-171.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-26 | SA Agent | Initial technical design |

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

The system follows a **layered architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────┐
│                MCP Tool Interface                 │
├─────────────────────────────────────────────────┤
│              Analysis Layer                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐│
│  │AI Context│ │ Quality  │ │    Security      ││
│  │  Tools   │ │ Analysis │ │    Analysis      ││
│  └──────────┘ └──────────┘ └──────────────────┘│
├─────────────────────────────────────────────────┤
│              Graph Layer                         │
│  ┌──────────────────────────────────────────┐   │
│  │  Call Graph │ Dep Graph │ Impact Analysis │   │
│  └──────────────────────────────────────────┘   │
├─────────────────────────────────────────────────┤
│              Parser Layer                        │
│  ┌──────────────────────────────────────────┐   │
│  │  Tree-sitter │ Symbol Extractor │ Cache  │   │
│  └──────────────────────────────────────────┘   │
├─────────────────────────────────────────────────┤
│              Infrastructure                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  Config  │ │  Cache   │ │  Embeddings  │   │
│  └──────────┘ └──────────┘ └──────────────┘   │
└─────────────────────────────────────────────────┘
```

![Architecture Diagram](diagrams/architecture.drawio)

### 1.2 Design Principles

1. **Feature Parity First** — behavior must match nodejs exactly
2. **Platform Idiomatic** — use native patterns (coroutines for Kotlin, asyncio for Python)
3. **Shared Test Fixtures** — same test inputs produce same outputs across platforms
4. **Incremental by Default** — all operations support incremental updates
5. **Fail Gracefully** — partial results on error, never crash

---

## 2. Module Design

### 2.1 Kotlin Module Structure

```
mcp-code-intelligence-kotlin/
├── src/main/kotlin/com/codeintel/
│   ├── parser/
│   │   ├── TreeSitterBinding.kt      # JNI wrapper
│   │   ├── LanguageRegistry.kt       # Parser loader
│   │   ├── ASTNode.kt                # AST data classes
│   │   ├── SymbolExtractor.kt        # Symbol extraction
│   │   └── IncrementalParser.kt      # Change tracking
│   ├── graph/
│   │   ├── GraphBuilder.kt           # Graph construction
│   │   ├── CallGraph.kt              # Call graph specific
│   │   ├── DependencyGraph.kt        # Import/dependency graph
│   │   ├── GraphTraversal.kt         # BFS, DFS, shortest path
│   │   ├── ImpactAnalysis.kt         # Change impact
│   │   └── CycleDetector.kt          # Circular dependency detection
│   ├── context/
│   │   ├── AIContextProvider.kt      # get_ai_context
│   │   ├── EditContextProvider.kt    # get_edit_context
│   │   ├── ContextRanker.kt          # TF-IDF + graph scoring
│   │   └── TokenBudget.kt            # jtokkit integration
│   ├── quality/
│   │   ├── ComplexityCalculator.kt   # Cyclomatic + cognitive
│   │   ├── EntryPointDetector.kt     # API/export detection
│   │   ├── CodeSmellDetector.kt      # Smell patterns
│   │   └── QualityReport.kt          # Report generation
│   ├── security/
│   │   ├── CFGBuilder.kt             # Control flow graph
│   │   ├── DFGBuilder.kt             # Data flow graph
│   │   ├── TaintAnalyzer.kt          # Source-to-sink tracking
│   │   ├── InjectionDetector.kt      # SQL/XSS/command injection
│   │   ├── SSRFDetector.kt           # SSRF patterns
│   │   ├── IDORDetector.kt           # IDOR patterns
│   │   └── VulnerabilityReport.kt    # Report + severity scoring
│   ├── similarity/
│   │   ├── DuplicateDetector.kt      # Exact + near-duplicate
│   │   ├── DeadCodeDetector.kt       # Unreachable code
│   │   ├── EmbeddingProvider.kt      # ONNX Runtime integration
│   │   └── SimilarityScorer.kt       # Pairwise scoring
│   ├── infra/
│   │   ├── Config.kt                 # Configuration management
│   │   ├── Cache.kt                  # LRU cache with TTL
│   │   └── Logger.kt                 # Structured logging
│   └── mcp/
│       ├── MCPServer.kt              # MCP protocol handler
│       ├── ToolRegistry.kt           # Tool registration
│       └── ToolHandlers.kt           # Request → response mapping
├── src/test/kotlin/
│   └── ... (mirrors main structure)
├── src/main/resources/
│   ├── grammars/                     # Tree-sitter .so files
│   └── models/                       # ONNX model files
└── build.gradle.kts
```

### 2.2 Python Module Structure

```
mcp-code-intelligence-python/
├── src/code_intel/
│   ├── parser/
│   │   ├── tree_sitter_binding.py    # py-tree-sitter wrapper
│   │   ├── language_registry.py      # Parser loader
│   │   ├── ast_node.py               # AST dataclasses
│   │   ├── symbol_extractor.py       # Symbol extraction
│   │   └── incremental_parser.py     # Change tracking
│   ├── graph/
│   │   ├── graph_builder.py          # NetworkX graph construction
│   │   ├── call_graph.py             # Call graph
│   │   ├── dependency_graph.py       # Import graph
│   │   ├── traversal.py              # BFS, DFS
│   │   ├── impact_analysis.py        # Change impact
│   │   └── cycle_detector.py         # Circular deps
│   ├── context/
│   │   ├── ai_context.py             # get_ai_context
│   │   ├── edit_context.py           # get_edit_context
│   │   ├── ranker.py                 # TF-IDF + graph scoring
│   │   └── token_budget.py           # tiktoken integration
│   ├── quality/
│   │   ├── complexity.py             # Cyclomatic + cognitive
│   │   ├── entry_points.py           # API detection
│   │   ├── code_smells.py            # Smell patterns
│   │   └── report.py                 # Report generation
│   ├── security/
│   │   ├── cfg_builder.py            # Control flow graph
│   │   ├── dfg_builder.py            # Data flow graph
│   │   ├── taint_analyzer.py         # Taint tracking
│   │   ├── injection_detector.py     # SQL/XSS/command
│   │   ├── ssrf_detector.py          # SSRF
│   │   ├── idor_detector.py          # IDOR
│   │   └── vulnerability_report.py   # Report + scoring
│   ├── similarity/
│   │   ├── duplicate_detector.py     # Duplicates
│   │   ├── dead_code_detector.py     # Dead code
│   │   ├── embedding_provider.py     # sentence-transformers
│   │   └── similarity_scorer.py      # Pairwise scoring
│   ├── infra/
│   │   ├── config.py                 # Configuration
│   │   ├── cache.py                  # LRU cache
│   │   └── logger.py                 # Structured logging
│   └── mcp/
│       ├── server.py                 # MCP protocol handler
│       ├── tool_registry.py          # Tool registration
│       └── handlers.py               # Request handlers
├── tests/
│   └── ... (mirrors src structure)
├── models/                           # Embedding models
└── pyproject.toml
```

---

## 3. Key Design Decisions

### 3.1 Graph Implementation

**Kotlin:** Custom adjacency list using `HashMap<String, MutableList<GraphEdge>>` for O(1) neighbor lookup. No external library to minimize dependencies and control memory layout.

**Python:** NetworkX `DiGraph` for rich graph algorithms out of the box. Trade-off: slightly higher memory usage but significantly less code to maintain.

### 3.2 Taint Analysis Algorithm

```pseudocode
function analyzeTaint(cfg, dfg, sources, sinks):
    taintedVars = Set()
    vulnerabilities = []
    
    // Forward taint propagation
    for each source in sources:
        taintedVars.add(source.variable)
        worklist = [source.node]
        
        while worklist not empty:
            node = worklist.pop()
            
            // Check if node is a sink
            if node in sinks:
                path = reconstructPath(source, node, dfg)
                vulnerabilities.add(Vulnerability(source, node, path))
                continue
            
            // Check for sanitization
            if isSanitizer(node):
                taintedVars.remove(node.output)
                continue
            
            // Propagate taint through assignments
            for each successor in dfg.successors(node):
                if successor.usesVariable(taintedVars):
                    taintedVars.add(successor.definesVariable)
                    worklist.add(successor)
    
    return vulnerabilities
```

### 3.3 Context Ranking Algorithm

```pseudocode
function rankContext(query, files, graph, tokenBudget):
    scores = []
    
    for each file in files:
        // TF-IDF score
        tfidf = computeTFIDF(query, file.content)
        
        // Graph proximity (distance from current file)
        graphScore = 1.0 / (1 + shortestPath(currentFile, file, graph))
        
        // Recency boost
        recency = 1.0 / (1 + daysSinceModified(file))
        
        // Combined score
        score = 0.5 * tfidf + 0.3 * graphScore + 0.2 * recency
        scores.add((file, score))
    
    // Sort by score descending
    scores.sortDescending()
    
    // Select within token budget
    result = []
    tokensUsed = 0
    for each (file, score) in scores:
        tokens = countTokens(file.relevantSnippet)
        if tokensUsed + tokens <= tokenBudget:
            result.add(file)
            tokensUsed += tokens
    
    return result
```

### 3.4 Incremental Update Strategy

```pseudocode
function onFileChanged(filePath, changeType):
    if changeType == DELETED:
        removeFromGraph(filePath)
        invalidateCache(filePath)
        return
    
    // Re-parse only changed file
    newAST = parser.parseIncremental(filePath, previousAST, editRange)
    
    // Update symbol table
    oldSymbols = symbolTable.get(filePath)
    newSymbols = extractSymbols(newAST)
    
    // Compute diff
    added = newSymbols - oldSymbols
    removed = oldSymbols - newSymbols
    
    // Update graph incrementally
    for each symbol in removed:
        graph.removeNode(symbol.id)
    for each symbol in added:
        graph.addNode(symbol)
        graph.addEdges(findReferences(symbol, newAST))
    
    // Invalidate affected caches
    affected = impactAnalysis(filePath)
    for each file in affected:
        invalidateCache(file)
```

---

## 4. API Design

### 4.1 MCP Tool Interface

All tools follow the MCP protocol (JSON-RPC over stdio):

| Tool Name | Input | Output | Batch |
|-----------|-------|--------|-------|
| `parse_file` | path, language? | AST + symbols | K1/P1 |
| `parse_directory` | path, extensions? | AST[] + symbols[] | K1/P1 |
| `get_call_graph` | path?, depth? | GraphNode[] + GraphEdge[] | K2/P2 |
| `get_dependency_graph` | path? | GraphNode[] + GraphEdge[] | K2/P2 |
| `impact_analysis` | changed_files | affected_files[] | K2/P2 |
| `get_ai_context` | query, max_tokens | context[] | K3/P3 |
| `get_edit_context` | file, line | context[] | K3/P3 |
| `analyze_quality` | path, metrics? | QualityReport | K4/P4 |
| `analyze_security` | path, checks? | VulnerabilityReport | K5/P5 |
| `find_duplicates` | path, threshold? | DuplicateGroup[] | K6/P6 |
| `find_dead_code` | path | DeadCode[] | K6/P6 |

### 4.2 Internal Module APIs

```kotlin
// Kotlin interfaces
interface Parser {
    suspend fun parse(path: Path): ASTNode
    suspend fun parseIncremental(path: Path, previous: ASTNode, edit: Edit): ASTNode
    fun extractSymbols(ast: ASTNode): List<Symbol>
}

interface GraphEngine {
    fun buildCallGraph(symbols: List<Symbol>, asts: Map<Path, ASTNode>): Graph
    fun buildDependencyGraph(files: List<Path>): Graph
    fun impactAnalysis(changed: Set<Path>): Set<Path>
    fun detectCycles(): List<List<GraphNode>>
}

interface SecurityAnalyzer {
    fun buildCFG(ast: ASTNode): ControlFlowGraph
    fun buildDFG(ast: ASTNode): DataFlowGraph
    fun analyzeTaint(cfg: ControlFlowGraph, dfg: DataFlowGraph): List<Vulnerability>
}
```

---

## 5. Security Design

### 5.1 Input Validation

- All file paths validated against workspace root (no path traversal)
- Token budget capped at 128K (prevent memory exhaustion)
- Graph size limited to 100K nodes (prevent OOM)
- Parse timeout: 10s per file

### 5.2 Dependency Security

- All dependencies pinned to exact versions
- ONNX models loaded from local filesystem only (no network fetch)
- Tree-sitter grammars bundled (no runtime download)

### 5.3 Data Privacy

- No source code sent to external services
- All analysis runs locally
- Embeddings computed locally (ONNX/sentence-transformers)

---

## 6. Error Handling

### 6.1 Error Strategy

| Layer | Strategy | Example |
|-------|----------|---------|
| Parser | Partial results + error nodes | Syntax error → partial AST |
| Graph | Skip unresolvable + warn | Dynamic import → warning |
| Analysis | Timeout + partial results | Large file → partial scan |
| MCP | Structured error response | Invalid path → error JSON |

### 6.2 Error Codes

| Code | Category | Description | Recovery |
|------|----------|-------------|----------|
| E001 | Parser | Language not supported | Return supported list |
| E002 | Parser | File not found | Return path in error |
| E003 | Parser | Parse timeout | Return partial AST |
| E004 | Graph | Graph too large | Suggest scope reduction |
| E005 | Embedding | Model load failure | Disable similarity |
| E006 | Context | Token overflow | Truncate + warn |
| E007 | Security | Taint timeout | Return partial results |
| E008 | Config | Invalid configuration | Return defaults + warn |

---

## 7. Performance Design

### 7.1 Caching Strategy

| Cache | Key | TTL | Eviction |
|-------|-----|-----|----------|
| AST Cache | file path + content hash | Until file change | LRU (1000 entries) |
| Graph Cache | project hash | Until any file change | Full invalidation |
| Embedding Cache | function content hash | 24h | LRU (10000 entries) |
| Symbol Cache | file path + content hash | Until file change | LRU (5000 entries) |

### 7.2 Concurrency Model

**Kotlin:**
- Structured concurrency with `CoroutineScope`
- File parsing: parallel with `async` (bounded to CPU cores)
- Graph operations: single-threaded (graph not thread-safe)
- Analysis: parallel per-file, sequential per-graph-operation

**Python:**
- `asyncio` for I/O-bound operations (file reading)
- `multiprocessing.Pool` for CPU-bound (parsing, analysis)
- Graph operations: single-threaded (NetworkX not thread-safe)

---

## 8. Testing Strategy

### 8.1 Cross-Platform Test Fixtures

Shared test fixtures stored in `test-fixtures/` directory:
- Input source files (various languages)
- Expected AST output (JSON)
- Expected graph output (JSON)
- Expected vulnerability findings (JSON)
- Expected quality metrics (JSON)

All three platforms (nodejs, Kotlin, Python) must produce identical output for same input.

### 8.2 Test Levels

| Level | Scope | Framework |
|-------|-------|-----------|
| Unit | Individual functions | JUnit 5 / pytest |
| Integration | Module interactions | Testcontainers / pytest-docker |
| E2E | Full MCP tool calls | Custom MCP test client |
| Parity | Cross-platform comparison | Custom comparison tool |

---

## 9. Implementation Checklist

### 9.1 Files to Create (Kotlin)

| # | File | Priority | Batch |
|---|------|----------|-------|
| 1 | TreeSitterBinding.kt | P0 | K1 |
| 2 | LanguageRegistry.kt | P0 | K1 |
| 3 | ASTNode.kt | P0 | K1 |
| 4 | SymbolExtractor.kt | P0 | K1 |
| 5 | GraphBuilder.kt | P0 | K2 |
| 6 | CallGraph.kt | P0 | K2 |
| 7 | DependencyGraph.kt | P0 | K2 |
| 8 | ImpactAnalysis.kt | P1 | K2 |
| 9 | AIContextProvider.kt | P0 | K3 |
| 10 | ContextRanker.kt | P0 | K3 |
| 11 | TokenBudget.kt | P0 | K3 |
| 12 | ComplexityCalculator.kt | P1 | K4 |
| 13 | CodeSmellDetector.kt | P1 | K4 |
| 14 | CFGBuilder.kt | P1 | K5 |
| 15 | DFGBuilder.kt | P1 | K5 |
| 16 | TaintAnalyzer.kt | P1 | K5 |
| 17 | DuplicateDetector.kt | P2 | K6 |
| 18 | EmbeddingProvider.kt | P2 | K6 |

### 9.2 Files to Create (Python)

Same structure as Kotlin with Python naming conventions (snake_case files).

---

## 10. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
