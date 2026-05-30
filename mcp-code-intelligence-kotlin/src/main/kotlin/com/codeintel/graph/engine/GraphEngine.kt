/** GraphEngine — main facade for the in-memory graph engine. KSA-173. */
package com.codeintel.graph.engine

import com.codeintel.graph.engine.analysis.CycleDetector
import com.codeintel.graph.engine.analysis.HotPathAnalyzer
import com.codeintel.graph.engine.analysis.ImpactAnalyzer
import com.codeintel.graph.engine.builder.*
import com.codeintel.graph.engine.model.*
import com.codeintel.graph.engine.store.DirectedGraph
import com.codeintel.graph.engine.traversal.BfsTraversal
import com.codeintel.graph.engine.traversal.DfsTraversal
import com.codeintel.graph.engine.traversal.ShortestPath
import java.util.concurrent.atomic.AtomicReference

class GraphEngine(
    private val provider: ParserDataProvider,
    private val config: GraphEngineConfig = GraphEngineConfig()
) {
    private val callGraph = AtomicReference<CodeGraph?>(null)
    private val depGraph = AtomicReference<CodeGraph?>(null)
    private val state = AtomicReference(GraphState.NOT_BUILT)
    private val updater = IncrementalUpdater(provider, config.incrementalThreshold)

    val currentState: GraphState get() = state.get()

    fun build(type: String = "both"): BuildResult {
        state.set(GraphState.BUILDING)
        return try {
            if (type in listOf("call", "both")) callGraph.set(CallGraphBuilder(provider).build())
            if (type in listOf("dependency", "both")) depGraph.set(DependencyGraphBuilder(provider).build())
            state.set(GraphState.READY)
            BuildResult(success = true, callGraph = callGraph.get()?.metadata, depGraph = depGraph.get()?.metadata)
        } catch (e: Exception) {
            state.set(GraphState.ERROR)
            BuildResult(success = false, error = e.message)
        }
    }

    fun impactAnalysis(target: String, type: String = "call_graph", depth: Int = 5): ImpactResult {
        val graph = selectGraph(type) ?: return ImpactResult(target = target)
        return ImpactAnalyzer(graph).analyze(target, depth.coerceIn(1, config.maxDepth))
    }

    fun traverse(start: String, algorithm: String = "bfs", direction: Direction = Direction.FORWARD, maxDepth: Int = 5, filter: TraversalFilter? = null): TraversalResult {
        val graph = callGraph.get()?.graph ?: return TraversalResult(start, algorithm, direction)
        val clampedDepth = maxDepth.coerceIn(1, config.maxDepth)
        return when (algorithm) {
            "dfs" -> DfsTraversal(graph).traverse(start, direction, clampedDepth, filter)
            else -> BfsTraversal(graph).traverse(start, direction, clampedDepth, filter)
        }
    }

    fun detectCycles(graphType: String = "dependency", scope: String? = null, minSeverity: CycleSeverity = CycleSeverity.WARNING): List<Cycle> {
        val graph = selectGraph(graphType) ?: return emptyList()
        return CycleDetector(graph).detectCycles(scope, minSeverity)
    }

    fun hotPaths(topN: Int = 10, scope: String? = null): List<HotPathResult> {
        val graph = callGraph.get()?.graph ?: return emptyList()
        return HotPathAnalyzer(graph).analyze(topN.coerceIn(1, 100), scope)
    }

    fun shortestPath(from: String, to: String, graphType: String = "call_graph"): List<String>? {
        val graph = selectGraph(graphType) ?: return null
        return ShortestPath(graph).find(from, to)
    }

    fun stats(graphType: String = "call_graph"): GraphMetadata? {
        return when (graphType) {
            "dependency" -> depGraph.get()?.metadata
            else -> callGraph.get()?.metadata
        }
    }

    fun neighbors(node: String, direction: Direction = Direction.FORWARD, graphType: String = "call_graph"): List<String> {
        val graph = selectGraph(graphType) ?: return emptyList()
        return when (direction) {
            Direction.FORWARD -> graph.getSuccessors(node)
            Direction.REVERSE -> graph.getPredecessors(node)
            Direction.BOTH -> graph.getSuccessors(node) + graph.getPredecessors(node)
        }
    }

    fun onFileChanged(filePath: String, changeType: ChangeType) {
        updater.enqueue(FileChange(filePath, changeType))
    }

    fun applyPendingUpdates(): Boolean {
        val cg = callGraph.get() ?: return false
        state.set(GraphState.UPDATING)
        val success = updater.applyTo(cg)
        state.set(if (success) GraphState.READY else GraphState.NOT_BUILT)
        return success
    }

    private fun selectGraph(type: String): DirectedGraph<GraphNode>? = when (type) {
        "dependency", "dependency_graph" -> depGraph.get()?.graph
        else -> callGraph.get()?.graph
    }
}

data class BuildResult(
    val success: Boolean = false,
    val callGraph: GraphMetadata? = null,
    val depGraph: GraphMetadata? = null,
    val error: String? = null
)
