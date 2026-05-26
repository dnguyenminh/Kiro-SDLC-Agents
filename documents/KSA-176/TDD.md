# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-176: [Kotlin] Security Analysis

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-176 |
| Title | [Kotlin] Security Analysis — Technical Design |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-26 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-176.docx |
| Related FSD | FSD-v1-KSA-176.docx |

---

## 1. Architecture Overview

### 1.1 Module Position

The Security Analysis module sits in the Analysis Layer, consuming:
- AST from Parser Layer (K1)
- Call Graph from Graph Layer (K2)

```
MCP Interface → SecurityAnalyzer → CFGBuilder + DFGBuilder → TaintAnalyzer → Detectors
                                         ↑                         ↑
                                    Parser (K1)              Graph Engine (K2)
```

### 1.2 Internal Architecture

```
security/
├── CFGBuilder.kt          # AST → Control Flow Graph
├── DFGBuilder.kt          # AST + CFG → Data Flow Graph
├── TaintAnalyzer.kt       # Core taint propagation engine
├── TaintSources.kt        # Source pattern definitions
├── TaintSinks.kt          # Sink pattern definitions
├── Sanitizers.kt          # Sanitization pattern definitions
├── detectors/
│   ├── InjectionDetector.kt    # SQL, XSS, Command injection
│   ├── SSRFDetector.kt         # Server-side request forgery
│   ├── IDORDetector.kt         # Insecure direct object reference
│   └── MisconfigDetector.kt    # Security misconfigurations
├── models/
│   ├── CFGNode.kt              # CFG data classes
│   ├── DFGNode.kt              # DFG data classes
│   ├── Vulnerability.kt        # Vulnerability report model
│   └── TaintState.kt           # Taint propagation state
└── SecurityAnalyzerFacade.kt   # Public API facade
```

---

## 2. Class Design

### 2.1 Core Classes

```kotlin
// CFG Builder
class CFGBuilder(private val parser: Parser) {
    fun build(functionAST: ASTNode): ControlFlowGraph
    fun buildForFile(fileAST: ASTNode): Map<String, ControlFlowGraph>
}

// DFG Builder
class DFGBuilder(private val cfgBuilder: CFGBuilder) {
    fun build(cfg: ControlFlowGraph, ast: ASTNode): DataFlowGraph
}

// Taint Analyzer (core engine)
class TaintAnalyzer(
    private val sources: TaintSourceRegistry,
    private val sinks: TaintSinkRegistry,
    private val sanitizers: SanitizerRegistry,
    private val callGraph: CallGraph  // from K2
) {
    suspend fun analyze(
        files: List<ParsedFile>,
        config: TaintConfig
    ): TaintAnalysisResult
    
    private fun propagateForward(
        startNode: DFGNode,
        dfg: DataFlowGraph,
        visited: MutableSet<String>
    ): List<TaintPath>
}

// Facade (public API)
class SecurityAnalyzerFacade(
    private val cfgBuilder: CFGBuilder,
    private val dfgBuilder: DFGBuilder,
    private val taintAnalyzer: TaintAnalyzer,
    private val detectors: List<VulnerabilityDetector>
) {
    suspend fun analyze(request: SecurityAnalysisRequest): SecurityAnalysisResult
}
```

### 2.2 Data Models

```kotlin
data class ControlFlowGraph(
    val entry: CFGNode,
    val exit: CFGNode,
    val nodes: List<CFGNode>,
    val edges: List<CFGEdge>
)

data class CFGNode(
    val id: String,
    val type: CFGNodeType,
    val astNode: ASTNode?,
    val line: Int,
    val expression: String
)

enum class CFGNodeType {
    ENTRY, EXIT, STATEMENT, BRANCH, LOOP_HEADER, MERGE, CALL, RETURN, THROW
}

data class CFGEdge(
    val source: String,
    val target: String,
    val label: String? = null  // "true", "false", "exception"
)

data class DataFlowGraph(
    val nodes: List<DFGNode>,
    val edges: List<DFGEdge>,
    val definitions: Map<String, List<DFGNode>>,  // variable → def nodes
    val uses: Map<String, List<DFGNode>>          // variable → use nodes
)

data class DFGNode(
    val id: String,
    val cfgNode: CFGNode,
    val variable: String?,
    val type: DFGNodeType
)

enum class DFGNodeType { DEF, USE, CALL_ARG, CALL_RETURN, PROPERTY_ACCESS, PROPERTY_ASSIGN }

data class DFGEdge(
    val source: String,
    val target: String,
    val type: DFGEdgeType
)

enum class DFGEdgeType { DATA_FLOW, CALL, RETURN, PROPERTY }
```

---

## 3. Algorithm Design

### 3.1 CFG Construction Algorithm

```pseudocode
function buildCFG(functionAST):
    entry = createNode(ENTRY)
    exit = createNode(EXIT)
    current = entry
    
    for each statement in functionAST.body:
        current = processStatement(statement, current, exit)
    
    addEdge(current, exit)
    return CFG(entry, exit)

function processStatement(stmt, predecessor, exitNode):
    switch stmt.type:
        case "if_statement":
            branch = createNode(BRANCH, stmt.condition)
            addEdge(predecessor, branch)
            
            merge = createNode(MERGE)
            
            // True branch
            trueEnd = processBlock(stmt.consequent, branch)
            addEdge(trueEnd, merge)
            
            // False branch
            if stmt.alternative:
                falseEnd = processBlock(stmt.alternative, branch)
                addEdge(falseEnd, merge)
            else:
                addEdge(branch, merge, "false")
            
            return merge
        
        case "while_statement":
            header = createNode(LOOP_HEADER, stmt.condition)
            addEdge(predecessor, header)
            
            bodyEnd = processBlock(stmt.body, header)
            addEdge(bodyEnd, header)  // back-edge
            
            afterLoop = createNode(STATEMENT)
            addEdge(header, afterLoop, "exit")
            return afterLoop
        
        case "return_statement":
            ret = createNode(RETURN, stmt)
            addEdge(predecessor, ret)
            addEdge(ret, exitNode)
            return createNode(STATEMENT)  // unreachable marker
        
        case "try_statement":
            tryEnd = processBlock(stmt.block, predecessor)
            catchStart = createNode(STATEMENT)
            // Exception edge from any node in try to catch
            for each node in tryBlock:
                addEdge(node, catchStart, "exception")
            catchEnd = processBlock(stmt.handler, catchStart)
            merge = createNode(MERGE)
            addEdge(tryEnd, merge)
            addEdge(catchEnd, merge)
            return merge
        
        default:
            node = createNode(STATEMENT, stmt)
            addEdge(predecessor, node)
            return node
```

### 3.2 Taint Propagation Algorithm

```pseudocode
function analyzeTaint(files, config):
    vulnerabilities = []
    
    for each file in files:
        cfg = cfgBuilder.buildForFile(file.ast)
        dfg = dfgBuilder.build(cfg, file.ast)
        
        // Find sources in this file
        sources = findSources(dfg, sourceRegistry)
        
        for each source in sources:
            // Forward propagation
            taintedPaths = propagateForward(source, dfg, config.maxDepth)
            
            for each path in taintedPaths:
                lastNode = path.last()
                
                // Check if last node is a sink
                sinkMatch = sinkRegistry.match(lastNode)
                if sinkMatch != null:
                    // Check for sanitization along path
                    if not isSanitized(path, sanitizerRegistry):
                        vuln = createVulnerability(source, lastNode, path, sinkMatch)
                        vulnerabilities.add(vuln)
    
    return TaintAnalysisResult(vulnerabilities, computeSummary(vulnerabilities))

function propagateForward(source, dfg, maxDepth):
    paths = []
    worklist = [(source, [source], 0)]  // (node, path, depth)
    visited = mutableSetOf(source.id)
    
    while worklist.isNotEmpty():
        (node, path, depth) = worklist.removeFirst()
        
        if depth >= maxDepth:
            continue
        
        for each successor in dfg.successors(node):
            if successor.id in visited:
                continue
            visited.add(successor.id)
            
            newPath = path + successor
            
            // If this is a function call, follow into callee
            if successor.type == CALL_ARG:
                calleePaths = followCall(successor, newPath, depth + 1)
                paths.addAll(calleePaths)
            else:
                worklist.add((successor, newPath, depth + 1))
                
                // If successor is a potential sink, record path
                if sinkRegistry.isPotentialSink(successor):
                    paths.add(newPath)
    
    return paths
```

### 3.3 Cross-File Taint Tracking

```pseudocode
function followCall(callNode, currentPath, depth):
    // Use call graph from K2 to resolve callee
    callee = callGraph.resolveCall(callNode.expression)
    if callee == null:
        return []  // unresolvable, conservative: don't report
    
    // Map arguments to parameters
    argMapping = mapArguments(callNode, callee)
    
    // Build CFG/DFG for callee if not cached
    calleeCFG = cfgBuilder.build(callee.ast)
    calleeDFG = dfgBuilder.build(calleeCFG, callee.ast)
    
    // Continue taint propagation in callee
    for each (argIndex, paramNode) in argMapping:
        if currentPath contains tainted argument at argIndex:
            calleePaths = propagateForward(paramNode, calleeDFG, maxDepth - depth)
            // Extend current path with callee paths
            for each calleePath in calleePaths:
                yield currentPath + calleePath
```

---

## 4. Detection Patterns

### 4.1 Source Patterns (Kotlin DSL)

```kotlin
val WEB_SOURCES = listOf(
    TaintSource("req.params.*", "Express request params"),
    TaintSource("req.body.*", "Express request body"),
    TaintSource("req.query.*", "Express query string"),
    TaintSource("req.headers.*", "HTTP headers"),
    TaintSource("request.input(*)", "Laravel input"),
    TaintSource("@RequestParam", "Spring request param"),
    TaintSource("@PathVariable", "Spring path variable"),
)

val SYSTEM_SOURCES = listOf(
    TaintSource("process.env.*", "Environment variable", sensitivity = MEDIUM),
    TaintSource("fs.readFileSync(*)", "File read"),
    TaintSource("readline()", "Console input"),
)
```

### 4.2 Sink Patterns

```kotlin
val SQL_SINKS = listOf(
    TaintSink("*.query(*)", VulnerabilityType.SQL_INJECTION, Severity.HIGH),
    TaintSink("*.execute(*)", VulnerabilityType.SQL_INJECTION, Severity.HIGH),
    TaintSink("*.$queryRaw(*)", VulnerabilityType.SQL_INJECTION, Severity.HIGH),
)

val COMMAND_SINKS = listOf(
    TaintSink("exec(*)", VulnerabilityType.COMMAND_INJECTION, Severity.CRITICAL),
    TaintSink("spawn(*)", VulnerabilityType.COMMAND_INJECTION, Severity.CRITICAL),
    TaintSink("eval(*)", VulnerabilityType.COMMAND_INJECTION, Severity.CRITICAL),
)

val XSS_SINKS = listOf(
    TaintSink("*.innerHTML", VulnerabilityType.XSS, Severity.MEDIUM),
    TaintSink("document.write(*)", VulnerabilityType.XSS, Severity.MEDIUM),
    TaintSink("res.send(*)", VulnerabilityType.XSS, Severity.MEDIUM),
)

val SSRF_SINKS = listOf(
    TaintSink("fetch(*)", VulnerabilityType.SSRF, Severity.HIGH),
    TaintSink("axios.*(*)", VulnerabilityType.SSRF, Severity.HIGH),
    TaintSink("http.get(*)", VulnerabilityType.SSRF, Severity.HIGH),
)
```

### 4.3 Sanitizer Patterns

```kotlin
val SANITIZERS = listOf(
    Sanitizer("escape(*)", breaks = setOf(SQL_INJECTION, XSS)),
    Sanitizer("encodeURIComponent(*)", breaks = setOf(XSS, SSRF)),
    Sanitizer("parseInt(*)", breaks = setOf(SQL_INJECTION, COMMAND_INJECTION)),
    Sanitizer("Number(*)", breaks = setOf(SQL_INJECTION, COMMAND_INJECTION)),
    Sanitizer("validator.isEmail(*)", breaks = setOf(SQL_INJECTION, XSS)),
    Sanitizer("DOMPurify.sanitize(*)", breaks = setOf(XSS)),
)
```

---

## 5. Performance Design

### 5.1 Optimization Strategies

| Strategy | Description | Impact |
|----------|-------------|--------|
| CFG caching | Cache CFG per function (keyed by content hash) | Avoid rebuild on re-analysis |
| Depth limiting | Max taint propagation depth = 10 | Prevent exponential blowup |
| Call depth limiting | Max cross-file call depth = 5 | Bound analysis time |
| Early termination | Stop path if sanitized | Reduce unnecessary work |
| Parallel file analysis | Analyze files in parallel (coroutines) | Utilize multi-core |
| Incremental analysis | Only re-analyze changed files | Fast re-scan |

### 5.2 Memory Management

- CFG/DFG objects are short-lived (per-function scope)
- Taint paths stored as linked lists (share common prefixes)
- Results streamed to output (don't accumulate all in memory)

---

## 6. Error Handling

| Scenario | Behavior |
|----------|----------|
| AST not available for file | Skip file, add to warnings |
| CFG construction fails | Skip function, continue with others |
| Taint timeout (per-file) | Return partial results for that file |
| Circular taint path | Detect via visited set, break cycle |
| Unresolvable call | Conservative: don't follow, don't report |
| Memory pressure | Reduce max depth, continue |

---

## 7. Testing Strategy

| Level | Focus | Count |
|-------|-------|-------|
| Unit | CFG construction correctness | 15 tests |
| Unit | DFG construction correctness | 12 tests |
| Unit | Taint propagation logic | 20 tests |
| Unit | Each detector individually | 30 tests |
| Integration | Full pipeline (parse → detect) | 10 tests |
| Parity | Compare with nodejs output | 20 tests |

---

## 8. Implementation Checklist

| # | File | Description | Priority | Est. LOC |
|---|------|-------------|----------|----------|
| 1 | CFGBuilder.kt | Control flow graph construction | P0 | 300 |
| 2 | DFGBuilder.kt | Data flow graph construction | P0 | 250 |
| 3 | TaintAnalyzer.kt | Core taint propagation engine | P0 | 400 |
| 4 | TaintSources.kt | Source pattern registry | P0 | 100 |
| 5 | TaintSinks.kt | Sink pattern registry | P0 | 100 |
| 6 | Sanitizers.kt | Sanitizer pattern registry | P0 | 80 |
| 7 | InjectionDetector.kt | SQL/XSS/Command detection | P0 | 200 |
| 8 | SSRFDetector.kt | SSRF detection | P1 | 100 |
| 9 | IDORDetector.kt | IDOR detection | P1 | 120 |
| 10 | MisconfigDetector.kt | Misconfiguration detection | P2 | 150 |
| 11 | SecurityAnalyzerFacade.kt | Public API | P0 | 100 |
| 12 | Models (all) | Data classes | P0 | 200 |

**Total estimated: ~2,100 LOC**

---

## 9. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
