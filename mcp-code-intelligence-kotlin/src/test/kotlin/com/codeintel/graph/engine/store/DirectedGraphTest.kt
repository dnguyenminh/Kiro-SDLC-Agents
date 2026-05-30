/** Unit tests for DirectedGraph. KSA-173. */
package com.codeintel.graph.engine.store

import com.codeintel.graph.engine.model.EdgeType
import com.codeintel.graph.engine.model.GraphEdge
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test

class DirectedGraphTest {
    private lateinit var graph: DirectedGraph<String>

    @BeforeEach
    fun setup() {
        graph = DirectedGraph()
    }

    @Test
    fun `addNode and containsNode`() {
        graph.addNode("a", "nodeA")
        assertTrue(graph.containsNode("a"))
        assertFalse(graph.containsNode("b"))
        assertEquals(1, graph.nodeCount())
    }

    @Test
    fun `removeNode removes node and edges`() {
        graph.addNode("a", "A")
        graph.addNode("b", "B")
        graph.addEdge(GraphEdge(id = "e1", source = "a", target = "b", type = EdgeType.CALL))
        graph.removeNode("b")
        assertFalse(graph.containsNode("b"))
        assertEquals(0, graph.edgeCount())
    }

    @Test
    fun `addEdge and getSuccessors`() {
        graph.addNode("a", "A")
        graph.addNode("b", "B")
        graph.addEdge(GraphEdge(id = "e1", source = "a", target = "b", type = EdgeType.CALL))
        assertEquals(listOf("b"), graph.getSuccessors("a"))
        assertEquals(emptyList<String>(), graph.getSuccessors("b"))
    }

    @Test
    fun `getPredecessors returns reverse edges`() {
        graph.addNode("a", "A")
        graph.addNode("b", "B")
        graph.addEdge(GraphEdge(id = "e1", source = "a", target = "b", type = EdgeType.CALL))
        assertEquals(listOf("a"), graph.getPredecessors("b"))
        assertEquals(emptyList<String>(), graph.getPredecessors("a"))
    }

    @Test
    fun `removeEdge by id`() {
        graph.addNode("a", "A")
        graph.addNode("b", "B")
        graph.addEdge(GraphEdge(id = "e1", source = "a", target = "b", type = EdgeType.CALL))
        assertEquals(1, graph.edgeCount())
        graph.removeEdge("e1")
        assertEquals(0, graph.edgeCount())
        assertEquals(emptyList<String>(), graph.getSuccessors("a"))
    }

    @Test
    fun `getAllNodes returns all node ids`() {
        graph.addNode("a", "A")
        graph.addNode("b", "B")
        graph.addNode("c", "C")
        assertEquals(setOf("a", "b", "c"), graph.getAllNodes())
    }

    @Test
    fun `clear removes everything`() {
        graph.addNode("a", "A")
        graph.addNode("b", "B")
        graph.addEdge(GraphEdge(id = "e1", source = "a", target = "b", type = EdgeType.CALL))
        graph.clear()
        assertEquals(0, graph.nodeCount())
        assertEquals(0, graph.edgeCount())
    }

    @Test
    fun `getOutEdges and getInEdges`() {
        graph.addNode("a", "A")
        graph.addNode("b", "B")
        val edge = GraphEdge(id = "e1", source = "a", target = "b", type = EdgeType.CALL)
        graph.addEdge(edge)
        assertEquals(1, graph.getOutEdges("a").size)
        assertEquals(0, graph.getOutEdges("b").size)
        assertEquals(1, graph.getInEdges("b").size)
        assertEquals(0, graph.getInEdges("a").size)
    }
}
