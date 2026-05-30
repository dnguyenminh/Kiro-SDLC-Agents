/** Integration test for GraphEngine facade. KSA-173. */
package com.codeintel.graph.engine

import com.codeintel.graph.engine.builder.ParserDataProvider
import com.codeintel.graph.engine.model.*
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class GraphEngineTest {
    private lateinit var engine: GraphEngine

    @BeforeEach
    fun setup() {
        engine = GraphEngine(TestDataProvider())
        engine.build("both")
    }

    @Test
    fun `build creates both graphs`() {
        assertEquals(GraphState.READY, engine.currentState)
        val callStats = engine.stats("call_graph")
        assertNotNull(callStats)
        assertTrue(callStats!!.totalNodes > 0)
        val depStats = engine.stats("dependency")
        assertNotNull(depStats)
    }

    @Test
    fun `impact analysis works`() {
        val result = engine.impactAnalysis("src/main.kt::main", depth = 3)
        assertNotNull(result)
        assertEquals("src/main.kt::main", result.target)
    }

    @Test
    fun `traverse BFS works`() {
        val result = engine.traverse("src/main.kt::main", "bfs", Direction.FORWARD, 3)
        assertEquals("bfs", result.algorithm)
        assertTrue(result.results.isNotEmpty())
    }

    @Test
    fun `traverse DFS works`() {
        val result = engine.traverse("src/main.kt::main", "dfs", Direction.FORWARD, 3)
        assertEquals("dfs", result.algorithm)
        assertTrue(result.results.isNotEmpty())
    }

    @Test
    fun `detect cycles finds circular deps`() {
        val cycles = engine.detectCycles("call_graph", minSeverity = CycleSeverity.INFO)
        // Our test data has a cycle: serviceA -> serviceB -> serviceA
        assertTrue(cycles.isNotEmpty())
    }

    @Test
    fun `hot paths returns ranked results`() {
        val results = engine.hotPaths(5)
        assertTrue(results.isNotEmpty())
        // Results should be sorted by composite score descending
        for (i in 0 until results.size - 1) {
            assertTrue(results[i].compositeScore >= results[i + 1].compositeScore)
        }
    }

    @Test
    fun `shortest path finds route`() {
        val path = engine.shortestPath("src/main.kt::main", "src/service.kt::serviceA")
        assertNotNull(path)
        assertEquals("src/main.kt::main", path!!.first())
        assertEquals("src/service.kt::serviceA", path.last())
    }

    @Test
    fun `neighbors returns adjacent nodes`() {
        val fwd = engine.neighbors("src/main.kt::main", Direction.FORWARD)
        assertTrue(fwd.isNotEmpty())
    }
}

/** Test data provider with a small graph for integration testing. */
private class TestDataProvider : ParserDataProvider {
    override fun getAllFiles() = listOf("src/main.kt", "src/service.kt", "src/util.kt")

    override fun getSymbolNodes(filePath: String): List<GraphNode> = when (filePath) {
        "src/main.kt" -> listOf(
            GraphNode("src/main.kt::main", NodeType.FUNCTION, "main", filePath),
            GraphNode("src/main.kt::init", NodeType.FUNCTION, "init", filePath)
        )
        "src/service.kt" -> listOf(
            GraphNode("src/service.kt::serviceA", NodeType.FUNCTION, "serviceA", filePath),
            GraphNode("src/service.kt::serviceB", NodeType.FUNCTION, "serviceB", filePath)
        )
        "src/util.kt" -> listOf(
            GraphNode("src/util.kt::log", NodeType.FUNCTION, "log", filePath),
            GraphNode("src/util.kt::format", NodeType.FUNCTION, "format", filePath)
        )
        else -> emptyList()
    }

    override fun getCallEdges(filePath: String): List<GraphEdge> = when (filePath) {
        "src/main.kt" -> listOf(
            GraphEdge(source = "src/main.kt::main", target = "src/service.kt::serviceA", type = EdgeType.CALL),
            GraphEdge(source = "src/main.kt::main", target = "src/util.kt::log", type = EdgeType.CALL),
            GraphEdge(source = "src/main.kt::init", target = "src/util.kt::log", type = EdgeType.CALL)
        )
        "src/service.kt" -> listOf(
            GraphEdge(source = "src/service.kt::serviceA", target = "src/service.kt::serviceB", type = EdgeType.CALL),
            GraphEdge(source = "src/service.kt::serviceB", target = "src/service.kt::serviceA", type = EdgeType.CALL), // cycle!
            GraphEdge(source = "src/service.kt::serviceA", target = "src/util.kt::log", type = EdgeType.CALL),
            GraphEdge(source = "src/service.kt::serviceB", target = "src/util.kt::format", type = EdgeType.CALL)
        )
        else -> emptyList()
    }

    override fun getImportEdges(filePath: String): List<GraphEdge> = when (filePath) {
        "src/main.kt" -> listOf(
            GraphEdge(source = "src/main.kt", target = "src/service.kt", type = EdgeType.STATIC_IMPORT),
            GraphEdge(source = "src/main.kt", target = "src/util.kt", type = EdgeType.STATIC_IMPORT)
        )
        "src/service.kt" -> listOf(
            GraphEdge(source = "src/service.kt", target = "src/util.kt", type = EdgeType.STATIC_IMPORT)
        )
        else -> emptyList()
    }
}
