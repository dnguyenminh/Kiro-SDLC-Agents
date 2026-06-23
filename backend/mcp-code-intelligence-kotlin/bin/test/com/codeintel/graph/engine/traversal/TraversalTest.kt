/** Unit tests for BFS and DFS traversal. KSA-173. */
package com.codeintel.graph.engine.traversal

import com.codeintel.graph.engine.model.Direction
import com.codeintel.graph.engine.model.EdgeType
import com.codeintel.graph.engine.model.GraphEdge
import com.codeintel.graph.engine.store.DirectedGraph
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class TraversalTest {
    private lateinit var graph: DirectedGraph<String>

    @BeforeEach
    fun setup() {
        graph = DirectedGraph()
        // Build: a -> b -> c -> d, a -> c
        listOf("a", "b", "c", "d").forEach { graph.addNode(it, it) }
        graph.addEdge(GraphEdge(id = "e1", source = "a", target = "b", type = EdgeType.CALL))
        graph.addEdge(GraphEdge(id = "e2", source = "b", target = "c", type = EdgeType.CALL))
        graph.addEdge(GraphEdge(id = "e3", source = "c", target = "d", type = EdgeType.CALL))
        graph.addEdge(GraphEdge(id = "e4", source = "a", target = "c", type = EdgeType.CALL))
    }

    @Test
    fun `BFS visits nodes in breadth-first order`() {
        val result = BfsTraversal(graph).traverse("a", Direction.FORWARD, 10)
        assertEquals("bfs", result.algorithm)
        assertEquals(4, result.results.size)
        assertEquals("a", result.results[0].nodeId)
        assertEquals(0, result.results[0].depth)
        // b and c at depth 1
        val depth1 = result.results.filter { it.depth == 1 }.map { it.nodeId }.toSet()
        assertEquals(setOf("b", "c"), depth1)
    }

    @Test
    fun `BFS respects maxDepth`() {
        val result = BfsTraversal(graph).traverse("a", Direction.FORWARD, 1)
        val maxDepth = result.results.maxOf { it.depth }
        assertEquals(1, maxDepth)
    }

    @Test
    fun `BFS reverse direction`() {
        val result = BfsTraversal(graph).traverse("d", Direction.REVERSE, 10)
        assertTrue(result.results.any { it.nodeId == "c" })
        assertTrue(result.results.any { it.nodeId == "a" })
    }

    @Test
    fun `DFS visits nodes in depth-first order`() {
        val result = DfsTraversal(graph).traverse("a", Direction.FORWARD, 10)
        assertEquals("dfs", result.algorithm)
        assertEquals(4, result.results.size)
        assertEquals("a", result.results[0].nodeId)
    }

    @Test
    fun `DFS respects maxDepth`() {
        val result = DfsTraversal(graph).traverse("a", Direction.FORWARD, 1)
        val maxDepth = result.results.maxOf { it.depth }
        assertEquals(1, maxDepth)
    }

    @Test
    fun `traverse non-existent node returns empty`() {
        val bfs = BfsTraversal(graph).traverse("nonexistent", Direction.FORWARD)
        assertTrue(bfs.results.isEmpty())
        val dfs = DfsTraversal(graph).traverse("nonexistent", Direction.FORWARD)
        assertTrue(dfs.results.isEmpty())
    }

    @Test
    fun `ShortestPath finds path`() {
        val path = ShortestPath(graph).find("a", "d")
        assertNotNull(path)
        assertEquals("a", path!!.first())
        assertEquals("d", path.last())
        assertTrue(path.size <= 4)
    }

    @Test
    fun `ShortestPath returns null when no path`() {
        graph.addNode("isolated", "isolated")
        val path = ShortestPath(graph).find("a", "isolated")
        assertNull(path)
    }

    @Test
    fun `ShortestPath same node`() {
        val path = ShortestPath(graph).find("a", "a")
        assertEquals(listOf("a"), path)
    }
}
