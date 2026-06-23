/** Unit tests for ImpactAnalyzer and HotPathAnalyzer. KSA-173. */
package com.codeintel.graph.engine.analysis

import com.codeintel.graph.engine.model.EdgeType
import com.codeintel.graph.engine.model.GraphEdge
import com.codeintel.graph.engine.store.DirectedGraph
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class AnalysisTest {
    private lateinit var graph: DirectedGraph<String>

    @BeforeEach
    fun setup() {
        graph = DirectedGraph()
        // a -> target, b -> target, c -> a, d -> b
        listOf("target", "a", "b", "c", "d").forEach { graph.addNode(it, it) }
        graph.addEdge(GraphEdge(id = "e1", source = "a", target = "target", type = EdgeType.CALL))
        graph.addEdge(GraphEdge(id = "e2", source = "b", target = "target", type = EdgeType.CALL))
        graph.addEdge(GraphEdge(id = "e3", source = "c", target = "a", type = EdgeType.CALL))
        graph.addEdge(GraphEdge(id = "e4", source = "d", target = "b", type = EdgeType.CALL))
    }

    @Test
    fun `impact analysis finds direct dependents`() {
        val result = ImpactAnalyzer(graph).analyze("target", 1)
        assertEquals("target", result.target)
        assertEquals(2, result.directDependents)
        assertEquals(2, result.totalAffected)
    }

    @Test
    fun `impact analysis finds transitive dependents`() {
        val result = ImpactAnalyzer(graph).analyze("target", 5)
        assertEquals(4, result.totalAffected)
        assertTrue(result.affected.any { it.nodeId == "c" })
        assertTrue(result.affected.any { it.nodeId == "d" })
    }

    @Test
    fun `impact analysis respects maxDepth`() {
        val result = ImpactAnalyzer(graph).analyze("target", 1)
        assertEquals(2, result.totalAffected)
        assertFalse(result.affected.any { it.nodeId == "c" })
    }

    @Test
    fun `impact analysis on non-existent node returns empty`() {
        val result = ImpactAnalyzer(graph).analyze("nonexistent")
        assertEquals(0, result.totalAffected)
    }

    @Test
    fun `impact scores decrease with distance`() {
        val result = ImpactAnalyzer(graph).analyze("target", 5)
        val direct = result.affected.filter { it.distance == 1 }
        val transitive = result.affected.filter { it.distance == 2 }
        assertTrue(direct.all { d -> transitive.all { t -> d.score >= t.score } })
    }

    @Test
    fun `hot path analyzer finds hub nodes`() {
        // Add more edges to make 'target' a hub
        listOf("e", "f", "g").forEach { graph.addNode(it, it) }
        graph.addEdge(GraphEdge(id = "e5", source = "e", target = "target", type = EdgeType.CALL))
        graph.addEdge(GraphEdge(id = "e6", source = "f", target = "target", type = EdgeType.CALL))
        graph.addEdge(GraphEdge(id = "e7", source = "g", target = "target", type = EdgeType.CALL))

        val results = HotPathAnalyzer(graph).analyze(3)
        assertTrue(results.isNotEmpty())
        // target should have highest in-degree
        val topNode = results.first()
        assertEquals("target", topNode.node)
        assertEquals(5, topNode.inDegree)
    }

    @Test
    fun `hot path analyzer respects scope`() {
        val results = HotPathAnalyzer(graph).analyze(10, scope = "nonexistent/")
        assertTrue(results.isEmpty())
    }
}
