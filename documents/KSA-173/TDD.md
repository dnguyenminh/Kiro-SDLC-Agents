# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-173: [Kotlin] Graph Engine

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-173 |
| Title | [Kotlin] Graph Engine |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-26 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-173.docx |
| Related BRD | BRD-v1-KSA-173.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-26 | SA Agent | Initial technical design |

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

The Graph Engine module follows a layered architecture:

```
┌─────────────────────────────────────────────────────┐
│                  MCP Tool Layer                       │
│    (graph_build, graph_traverse, graph_impact, ...)  │
├─────────────────────────────────────────────────────┤
│                 Service Layer                         │
│  (GraphBuildService, TraversalService, AnalysisService)│
├─────────────────────────────────────────────────────┤
│                  Core Layer                           │
│  (CallGraphBuilder, DepGraphBuilder, CycleDetector)  │
├─────────────────────────────────────────────────────┤
│               Data Structure Layer                    │
│  (DirectedGraph, AdjacencyList, GraphNode, GraphEdge)│
├─────────────────────────────────────────────────────┤
│              Integration Layer                        │
│  (ParserDataProvider adapter from KSA-172)           │
└─────────────────────────────────────────────────────┘
```

![Architecture](diagrams/architecture.png)

### 1.2 Design Principles

1. **Immutability**: Graph snapshots are immutable; updates create new generation
2. **Thread Safety**: Read-write lock for concurrent query access during updates
3. **Lazy Construction**: Graph built on first query, not at startup
4. **Fail-Safe**: Partial graphs returned on error, never crash
5. **Platform Parity**: Output structure matches nodejs v2 exactly
6. **Memory Efficiency**: Adjacency list representation, no matrix storage

---

## 2. Module Structure

### 2.1 Gradle Module Layout

```
mcp-code-intelligence-kotlin/
├── graph-engine/                    # This module (KSA-173)
│   ├── src/main/kotlin/
│   │   └── com/codeintel/graph/
│   │       ├── GraphEngine.kt              # Main entry point / facade
│   │       ├── GraphEngineConfig.kt        # Configuration
│   │       ├── builder/
│   │       │   ├── CallGraphBuilder.kt     # Call graph construction
│   │       │   ├── DependencyGraphBuilder.kt # Dependency graph construction
│   │       │   ├── CallResolver.kt         # Resolve call targets
│   │       │   ├── ImportResolver.kt       # Resolve import paths
│   │       │   └── IncrementalUpdater.kt   # Incremental graph updates
│   │       ├── model/
│   │       │   ├── GraphNode.kt            # Node data class
│   │       │   ├── GraphEdge.kt            # Edge data class
│   │       │   ├── CodeGraph.kt            # Complete graph structure
│   │       │   ├── NodeType.kt             # Node type enum
│   │       │   ├── EdgeType.kt             # Edge type enum
│   │       │   ├── GraphMetadata.kt        # Graph statistics
│   │       │   └── GraphState.kt           # State enum
│   │       ├── traversal/
│   │       │   ├── BfsTraversal.kt         # Breadth-first search
│   │       │   ├── DfsTraversal.kt         # Depth-first search
│   │       │   ├── ShortestPath.kt         # BFS-based shortest path
│   │       │   └── TraversalFilter.kt      # Filter criteria
│   │       ├── analysis/
│   │       │   ├── ImpactAnalyzer.kt       # Change impact analysis
│   │       │   ├── CycleDetector.kt        # Tarjan's SCC algorithm
│   │       │   ├── HotPathAnalyzer.kt      # Centrality metrics
│   │       │   └── ConnectedComponents.kt  # SCC identification
│   │       ├── store/
│   │       │   ├── DirectedGraph.kt        # Core graph data structure
│   │       │   ├── AdjacencyList.kt        # Adjacency list impl
│   │       │   └── GraphIndex.kt           # Fast lookup indices
│   │       ├── mcp/
│   │       │   ├── GraphToolHandler.kt     # MCP tool registration
│   │       │   └── GraphToolSchemas.kt     # JSON schemas
│   │       └── integration/
│   │           └── ParserDataAdapter.kt    # Adapter for KSA-172
│   ├── src/test/kotlin/
│   │   └── com/codeintel/graph/
│   │       ├── builder/CallGraphBuilderTest.kt
│   │       ├── builder/DependencyGraphBuilderTest.kt
│   │       ├── traversal/BfsTraversalTest.kt
│   │       ├── traversal/DfsTraversalTest.kt
│   │       ├── analysis/ImpactAnalyzerTest.kt
│   │       ├── analysis/CycleDetectorTest.kt
│   │       ├── analysis/HotPathAnalyzerTest.kt
│   │       └── integration/GraphEngineIntegrationTest.kt
│   └── build.gradle.kts
```

### 2.2 Dependencies

```kotlin
// build.gradle.kts
dependencies {
    implementation(project(":tree-sitter-core"))  // KSA-172
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.2")
    testImplementation("io.mockk:mockk:1.13.10")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.0")
}
```

---

## 3. Detailed Design

### 3.1 Core Data Structure — DirectedGraph

```kotlin
class DirectedGraph<T> {
    private val nodes: MutableMap<String, T> = ConcurrentHashMap()
    private val forwardEdges: MutableMap<String, MutableList<GraphEdge>> = ConcurrentHashMap()
    private val reverseEdges: MutableMap<String, MutableList<GraphEdge>> = ConcurrentHashMap()
    private val rwLock = ReentrantReadWriteLock()
    
    fun addNode(id: String, data: T) { ... }
    fun removeNode(id: String) { ... }
    fun addEdge(edge: GraphEdge) { ... }
    fun removeEdge(edgeId: String) { ... }
    
    fun getSuccessors(nodeId: String): List<String> = readLock { forwardEdges[nodeId]?.map { it.target } ?: emptyList() }
    fun getPredecessors(nodeId: String): List<String> = readLock { reverseEdges[nodeId]?.map { it.source } ?: emptyList() }
    fun getOutEdges(nodeId: String): List<GraphEdge> = readLock { forwardEdges[nodeId] ?: emptyList() }
    fun getInEdges(nodeId: String): List<GraphEdge> = readLock { reverseEdges[nodeId] ?: emptyList() }
    
    fun nodeCount(): Int = nodes.size
    fun edgeCount(): Int = forwardEdges.values.sumOf { it.size }
    fun containsNode(id: String): Boolean = nodes.containsKey(id)
    fun getAllNodes(): Collection<String> = nodes.keys
}
```

### 3.2 Call Graph Builder

```kotlin
class CallGraphBuilder(
    private val parserProvider: ParserDataProvider,
    private val callResolver: CallResolver,
    private val config: GraphEngineConfig
) {
    suspend fun build(projectPath: String): CodeGraph {
        val graph = DirectedGraph<GraphNode>()
        val files = parserProvider.getAllParsedFiles()
        
        // Phase 1: Add all function/method nodes
        coroutineScope {
            files.chunked(config.batchSize).map { batch ->
                async(Dispatchers.Default) {
                    batch.flatMap { file ->
                        val symbols = parserProvider.getSymbolTable(file)
                        symbols.functions.map { sym ->
                            GraphNode(
                                id = "${file}::${sym.qualifiedName}",
                                type = NodeType.FUNCTION,
                                name = sym.name,
                                filePath = file,
                                position = sym.position,
                                language = sym.language,
                                visibility = sym.visibility
                            )
                        }
                    }
                }
            }.awaitAll().flatten().forEach { node ->
                graph.addNode(node.id, node)
            }
        }
        
        // Phase 2: Add call edges
        coroutineScope {
            files.chunked(config.batchSize).map { batch ->
                async(Dispatchers.Default) {
                    batch.flatMap { file ->
                        val ast = parserProvider.getAstRoot(file)
                        val symbols = parserProvider.getSymbolTable(file)
                        extractCallEdges(file, ast, symbols)
                    }
                }
            }.awaitAll().flatten().forEach { edge ->
                graph.addEdge(edge)
            }
        }
        
        return CodeGraph(
            type = GraphType.CALL_GRAPH,
            graph = graph,
            metadata = GraphMetadata(projectPath, files.size, graph.nodeCount(), graph.edgeCount())
        )
    }
    
    private fun extractCallEdges(file: String, ast: AstNode, symbols: SymbolTable): List<GraphEdge> {
        val edges = mutableListOf<GraphEdge>()
        val callExpressions = ast.findAll("call_expression")
        
        for (call in callExpressions) {
            val caller = findEnclosingFunction(call, symbols) ?: continue
            val callerId = "${file}::${caller.qualifiedName}"
            val targetName = extractCallTarget(call)
            
            val resolved = callResolver.resolve(targetName, file, symbols)
            when (resolved) {
                is ResolvedTarget.Direct -> edges.add(GraphEdge(
                    source = callerId, target = resolved.targetId,
                    type = EdgeType.CALL, metadata = EdgeMetadata(CallType.DIRECT, 1.0f)
                ))
                is ResolvedTarget.Virtual -> resolved.implementations.forEach { impl ->
                    edges.add(GraphEdge(
                        source = callerId, target = impl,
                        type = EdgeType.CALL, metadata = EdgeMetadata(CallType.VIRTUAL, 0.7f)
                    ))
                }
                is ResolvedTarget.Unresolved -> edges.add(GraphEdge(
                    source = callerId, target = "UNRESOLVED::${targetName}",
                    type = EdgeType.UNRESOLVED, metadata = EdgeMetadata(CallType.DIRECT, 0.0f)
                ))
            }
        }
        return edges
    }
}
```

### 3.3 Cycle Detector (Tarjan's Algorithm)

```kotlin
class CycleDetector {
    fun detectCycles(graph: DirectedGraph<GraphNode>): List<Cycle> {
        var index = 0
        val stack = ArrayDeque<String>()
        val indices = mutableMapOf<String, Int>()
        val lowlinks = mutableMapOf<String, Int>()
        val onStack = mutableSetOf<String>()
        val sccs = mutableListOf<List<String>>()
        
        fun strongConnect(node: String) {
            indices[node] = index
            lowlinks[node] = index
            index++
            stack.addLast(node)
            onStack.add(node)
            
            for (successor in graph.getSuccessors(node)) {
                if (successor !in indices) {
                    strongConnect(successor)
                    lowlinks[node] = minOf(lowlinks[node]!!, lowlinks[successor]!!)
                } else if (successor in onStack) {
                    lowlinks[node] = minOf(lowlinks[node]!!, indices[successor]!!)
                }
            }
            
            if (lowlinks[node] == indices[node]) {
                val scc = mutableListOf<String>()
                do {
                    val w = stack.removeLast()
                    onStack.remove(w)
                    scc.add(w)
                } while (w != node)
                
                if (scc.size > 1) {
                    sccs.add(scc)
                }
            }
        }
        
        for (node in graph.getAllNodes()) {
            if (node !in indices) {
                strongConnect(node)
            }
        }
        
        return sccs.map { classifyCycle(it, graph) }
    }
    
    private fun classifyCycle(nodes: List<String>, graph: DirectedGraph<GraphNode>): Cycle {
        val path = reconstructCyclePath(nodes, graph)
        val severity = when {
            nodes.size == 1 -> CycleSeverity.INFO       // Self-recursion
            nodes.all { it.contains("::") } -> CycleSeverity.WARNING  // Mutual recursion
            else -> CycleSeverity.ERROR                 // Circular dependency
        }
        return Cycle(nodes = nodes, path = path, severity = severity)
    }
}
```

### 3.4 Impact Analyzer

```kotlin
class ImpactAnalyzer(private val graph: DirectedGraph<GraphNode>) {
    fun analyze(target: String, maxDepth: Int = Int.MAX_VALUE): ImpactResult {
        val visited = mutableSetOf<String>()
        val queue: Queue<Pair<String, Int>> = LinkedList()
        val affected = mutableListOf<AffectedNode>()
        
        queue.add(target to 0)
        visited.add(target)
        
        while (queue.isNotEmpty()) {
            val (current, depth) = queue.poll()
            if (depth > maxDepth) break
            
            val predecessors = graph.getPredecessors(current)
            for (pred in predecessors) {
                if (pred !in visited) {
                    visited.add(pred)
                    val score = calculateScore(pred, depth + 1)
                    affected.add(AffectedNode(pred, depth + 1, score))
                    queue.add(pred to (depth + 1))
                }
            }
        }
        
        return ImpactResult(
            target = target,
            totalAffected = affected.size,
            directDependents = affected.count { it.distance == 1 },
            affected = affected.sortedByDescending { it.score }
        )
    }
    
    private fun calculateScore(node: String, distance: Int): Double {
        val distanceFactor = 1.0 / distance
        val fanOut = graph.getSuccessors(node).size
        val fanOutFactor = minOf(1.0, fanOut / 10.0)
        return distanceFactor * 0.7 + fanOutFactor * 0.3
    }
}
```

### 3.5 BFS/DFS Traversal

```kotlin
class BfsTraversal(private val graph: DirectedGraph<GraphNode>) {
    fun traverse(
        start: String,
        direction: Direction = Direction.FORWARD,
        maxDepth: Int = Int.MAX_VALUE,
        filter: TraversalFilter? = null
    ): TraversalResult {
        val visited = mutableSetOf<String>()
        val queue: Queue<Pair<String, Int>> = LinkedList()
        val results = mutableListOf<TraversalNode>()
        
        queue.add(start to 0)
        visited.add(start)
        
        while (queue.isNotEmpty()) {
            val (current, depth) = queue.poll()
            if (depth > maxDepth) break
            
            results.add(TraversalNode(current, depth))
            
            val neighbors = when (direction) {
                Direction.FORWARD -> graph.getSuccessors(current)
                Direction.REVERSE -> graph.getPredecessors(current)
                Direction.BOTH -> graph.getSuccessors(current) + graph.getPredecessors(current)
            }
            
            for (neighbor in neighbors) {
                if (neighbor !in visited && (filter == null || filter.matches(neighbor))) {
                    visited.add(neighbor)
                    queue.add(neighbor to (depth + 1))
                }
            }
        }
        
        return TraversalResult(start, "bfs", direction, results)
    }
}

class DfsTraversal(private val graph: DirectedGraph<GraphNode>) {
    fun traverse(
        start: String,
        direction: Direction = Direction.FORWARD,
        maxDepth: Int = Int.MAX_VALUE,
        filter: TraversalFilter? = null
    ): TraversalResult {
        val visited = mutableSetOf<String>()
        val results = mutableListOf<TraversalNode>()
        
        fun dfs(node: String, depth: Int) {
            if (depth > maxDepth || node in visited) return
            visited.add(node)
            results.add(TraversalNode(node, depth))
            
            val neighbors = when (direction) {
                Direction.FORWARD -> graph.getSuccessors(node)
                Direction.REVERSE -> graph.getPredecessors(node)
                Direction.BOTH -> graph.getSuccessors(node) + graph.getPredecessors(node)
            }
            
            for (neighbor in neighbors) {
                if (neighbor !in visited && (filter == null || filter.matches(neighbor))) {
                    dfs(neighbor, depth + 1)
                }
            }
        }
        
        dfs(start, 0)
        return TraversalResult(start, "dfs", direction, results)
    }
}
```

### 3.6 Hot Path Analyzer

```kotlin
class HotPathAnalyzer(private val graph: DirectedGraph<GraphNode>) {
    fun analyze(topN: Int = 10, scope: String? = null): List<HotPathResult> {
        val nodes = if (scope != null) {
            graph.getAllNodes().filter { it.startsWith(scope) }
        } else {
            graph.getAllNodes().toList()
        }
        
        return nodes.map { node ->
            val inDegree = graph.getPredecessors(node).size
            val outDegree = graph.getSuccessors(node).size
            val betweenness = calculateBetweenness(node, nodes)
            val compositeScore = (inDegree * 0.4 + outDegree * 0.2 + betweenness * 100 * 0.4) / 
                                 maxOf(1.0, nodes.size.toDouble() / 10)
            
            HotPathResult(
                node = node,
                inDegree = inDegree,
                outDegree = outDegree,
                betweenness = betweenness,
                compositeScore = compositeScore,
                classification = classify(inDegree, outDegree)
            )
        }.sortedByDescending { it.compositeScore }.take(topN)
    }
    
    private fun calculateBetweenness(node: String, allNodes: List<String>): Double {
        // Simplified betweenness: fraction of shortest paths through this node
        var pathsThrough = 0
        var totalPaths = 0
        
        for (source in allNodes.take(100)) { // Sample for performance
            if (source == node) continue
            val paths = findShortestPaths(source, allNodes.take(100), graph)
            for ((_, path) in paths) {
                totalPaths++
                if (node in path) pathsThrough++
            }
        }
        
        return if (totalPaths > 0) pathsThrough.toDouble() / totalPaths else 0.0
    }
    
    private fun classify(inDegree: Int, outDegree: Int): String = when {
        inDegree > 20 && outDegree < 5 -> "utility_hub"
        inDegree > 10 && outDegree > 10 -> "service_hub"
        outDegree > 20 && inDegree < 5 -> "orchestrator"
        else -> "normal"
    }
}
```

### 3.7 Incremental Updater

```kotlin
class IncrementalUpdater(
    private val callGraphBuilder: CallGraphBuilder,
    private val depGraphBuilder: DependencyGraphBuilder,
    private val config: GraphEngineConfig
) {
    private val pendingUpdates = ConcurrentLinkedQueue<FileChange>()
    private val batchDebounceMs = 100L
    
    suspend fun onFileChanged(filePath: String, changeType: ChangeType) {
        pendingUpdates.add(FileChange(filePath, changeType, Instant.now()))
        
        // Debounce: wait for batch
        delay(batchDebounceMs)
        processBatch()
    }
    
    private suspend fun processBatch() {
        val changes = mutableListOf<FileChange>()
        while (pendingUpdates.isNotEmpty()) {
            changes.add(pendingUpdates.poll())
        }
        
        if (changes.isEmpty()) return
        
        // Check threshold: if too many changes, full rebuild
        val totalFiles = callGraph.metadata.totalFiles
        if (changes.size > totalFiles * config.incrementalThreshold) {
            triggerFullRebuild()
            return
        }
        
        // Incremental update
        for (change in changes) {
            when (change.type) {
                ChangeType.MODIFIED -> updateFile(change.filePath)
                ChangeType.DELETED -> removeFile(change.filePath)
                ChangeType.CREATED -> addFile(change.filePath)
            }
        }
        
        incrementGeneration()
    }
    
    private fun updateFile(filePath: String) {
        // Remove all edges FROM this file's symbols
        val existingNodes = callGraph.graph.getAllNodes().filter { it.startsWith(filePath) }
        for (node in existingNodes) {
            callGraph.graph.getOutEdges(node).forEach { callGraph.graph.removeEdge(it.id) }
        }
        
        // Re-extract and add new edges
        val newEdges = callGraphBuilder.extractCallEdges(filePath)
        newEdges.forEach { callGraph.graph.addEdge(it) }
    }
}
```

---

## 4. API Design

### 4.1 MCP Tool Schemas

```kotlin
// graph_build
data class BuildRequest(
    val path: String,
    val type: String = "both"  // "call", "dependency", "both"
)

// graph_impact_analysis
data class ImpactRequest(
    val target: String,
    val type: String = "call_graph",
    val depth: Int = 5,
    val includeExternal: Boolean = false
)

// graph_traverse
data class TraverseRequest(
    val start: String,
    val algorithm: String = "bfs",
    val direction: String = "forward",
    val maxDepth: Int = 5,
    val filter: FilterSpec? = null
)

// graph_detect_cycles
data class CycleRequest(
    val graphType: String = "dependency",
    val scope: String? = null,
    val minSeverity: String = "warning"
)

// graph_hot_paths
data class HotPathRequest(
    val topN: Int = 10,
    val scope: String? = null,
    val metric: String = "composite"
)
```

---

## 5. Error Handling

| Error Code | Condition | Response | HTTP-equiv |
|------------|-----------|----------|------------|
| GRAPH_001 | Graph not built | `{ error: "Graph not initialized. Call graph_build first." }` | 412 |
| GRAPH_002 | Node not found | `{ error: "Node not found", suggestions: [...] }` | 404 |
| GRAPH_003 | Depth exceeded | `{ warning: "Truncated at depth N", partial: true }` | 200 |
| GRAPH_004 | Memory limit | `{ error: "Memory limit exceeded", partial_graph: {...} }` | 507 |
| GRAPH_005 | Build in progress | `{ error: "Graph build in progress", progress: 0.6 }` | 409 |
| GRAPH_006 | Invalid request | `{ error: "Invalid parameter", details: {...} }` | 400 |

---

## 6. Security Design

| Concern | Mitigation |
|---------|-----------|
| Path traversal in file paths | Normalize and validate all paths against project root |
| DoS via deep traversal | Enforce max_depth limit (default 10, max 100) |
| Memory exhaustion | Graph size limit (configurable, default 50K nodes) |
| Concurrent modification | Read-write lock prevents data corruption |
| Information disclosure | External nodes only show package name, not full path |

---

## 7. Performance Design

### 7.1 Optimization Strategies

| Strategy | Component | Expected Gain |
|----------|-----------|---------------|
| Parallel file processing | CallGraphBuilder | 3-4x speedup on multi-core |
| Adjacency list (not matrix) | DirectedGraph | O(V+E) memory vs O(V²) |
| Lazy betweenness (sampling) | HotPathAnalyzer | O(V*sample) vs O(V³) |
| Incremental updates | IncrementalUpdater | 100x faster than full rebuild |
| Read-write lock | DirectedGraph | Concurrent reads during updates |
| Batch debouncing | IncrementalUpdater | Reduce update frequency |

### 7.2 Memory Budget

| Component | 1K files | 5K files | 10K files |
|-----------|----------|----------|-----------|
| Call graph nodes | ~50MB | ~250MB | ~500MB |
| Call graph edges | ~100MB | ~500MB | ~1GB |
| Dependency graph | ~20MB | ~100MB | ~200MB |
| Indices | ~30MB | ~150MB | ~300MB |
| **Total** | **~200MB** | **~1GB** | **~2GB** |

---

## 8. Implementation Checklist

### Files to Create

| # | File | Priority | Depends On |
|---|------|----------|------------|
| 1 | `model/GraphNode.kt` | P0 | None |
| 2 | `model/GraphEdge.kt` | P0 | None |
| 3 | `model/CodeGraph.kt` | P0 | #1, #2 |
| 4 | `model/NodeType.kt` | P0 | None |
| 5 | `model/EdgeType.kt` | P0 | None |
| 6 | `store/DirectedGraph.kt` | P0 | #1, #2 |
| 7 | `store/AdjacencyList.kt` | P0 | None |
| 8 | `store/GraphIndex.kt` | P1 | #6 |
| 9 | `builder/CallResolver.kt` | P0 | KSA-172 |
| 10 | `builder/CallGraphBuilder.kt` | P0 | #6, #9 |
| 11 | `builder/DependencyGraphBuilder.kt` | P0 | #6, KSA-172 |
| 12 | `builder/IncrementalUpdater.kt` | P1 | #10, #11 |
| 13 | `traversal/BfsTraversal.kt` | P0 | #6 |
| 14 | `traversal/DfsTraversal.kt` | P0 | #6 |
| 15 | `traversal/ShortestPath.kt` | P1 | #13 |
| 16 | `analysis/ImpactAnalyzer.kt` | P0 | #6, #13 |
| 17 | `analysis/CycleDetector.kt` | P0 | #6 |
| 18 | `analysis/HotPathAnalyzer.kt` | P1 | #6, #15 |
| 19 | `mcp/GraphToolHandler.kt` | P0 | All above |
| 20 | `GraphEngine.kt` | P0 | All above |
| 21 | `integration/ParserDataAdapter.kt` | P0 | KSA-172 |

### Files to Modify

| # | File | Change | Reason |
|---|------|--------|--------|
| 1 | `settings.gradle.kts` | Add `include(":graph-engine")` | Register new module |
| 2 | `mcp-server/build.gradle.kts` | Add `implementation(project(":graph-engine"))` | Wire dependency |
| 3 | `mcp-server/McpToolRegistry.kt` | Register graph tools | Expose via MCP |

---

## 9. Testing Strategy

| Level | Focus | Tools |
|-------|-------|-------|
| Unit | Individual algorithms (BFS, DFS, Tarjan) | JUnit 5 + MockK |
| Integration | Builder + Parser interaction | Testcontainers (if needed) |
| Property-based | Graph invariants (no dangling edges, etc.) | Kotest property testing |
| Performance | Benchmark against targets | JMH |
| Parity | Compare output with nodejs v2 | Shared test fixtures |

---

## 10. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
