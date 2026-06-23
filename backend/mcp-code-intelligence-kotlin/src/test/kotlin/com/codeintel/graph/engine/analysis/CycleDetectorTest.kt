/** Unit tests for CycleDetector. KSA-173. */
package com.codeintel.graph.engine.analysis

import com.codeintel.graph.engine.model.CycleSeverity
import com.codeintel.graph.engine.model.EdgeType
import com.codeintel.graph.engine.model.GraphEdge
import com.codeintel.graph.engine.store.DirectedGraph
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class CycleDetectorTest {

    @Test
    fun `detects simple cycle`() {
        val graph = DirectedGraph<String>()
        listOf("a", "b", "c").forEach { graph.addNode(it, it) }
        graph.addEdge(GraphEdge(id = "e1", source = "a", target = "b", type = EdgeType.CALL))
        graph.addEdge(GraphEdge(id = "e2", source = "b", target = "c", type = EdgeType.CALL))
        graph.addEdge(GraphEdge(id = "e3", source = "c", target = "a", type = EdgeType.CALL))

        val cycles = CycleDetector(graph).detectCycles()
        assertEquals(1, cycles.size)
        assertEquals(3, cycles[0].nodes.size)
    }

    @Test
    fun `no cycles in DAG`() {
        val graph = DirectedGraph<String>()
        listOf("a", "b", "c").forEach { graph.addNode(it, it) }
        graph.addEdge(GraphEdge(id = "e1", source = "a", target = "b", type = EdgeType.CALL))
        graph.addEdge(GraphEdge(id = "e2", source = "b", target = "c", type = EdgeType.CALL))

        val cycles = CycleDetector(graph).detectCycles()
        assertTrue(cycles.isEmpty())
    }

    @Test
    fun `detects multiple cycles`() {
        val graph = DirectedGraph<String>()
        listOf("a", "b", "c", "d", "e").forEach { graph.addNode(it, it) }
        // Cycle 1: a -> b -> a
        graph.addEdge(GraphEdge(id = "e1", source = "a", target = "b", type = EdgeType.CALL))
        graph.addEdge(GraphEdge(id = "e2", source = "b", target = "a", type = EdgeType.CALL))
        // Cycle 2: c -> d -> e -> c
        graph.addEdge(GraphEdge(id = "e3", source = "c", target = "d", type = EdgeType.CALL))
        graph.addEdge(GraphEdge(id = "e4", source = "d", target = "e", type = EdgeType.CALL))
        graph.addEdge(GraphEdge(id = "e5", source = "e", target = "c", type = EdgeType.CALL))

        val cycles = CycleDetector(graph).detectCycles()
        assertEquals(2, cycles.size)
    }

    @Test
    fun `scope filter limits detection`() {
        val graph = DirectedGraph<String>()
        listOf("src/a", "src/b", "lib/c", "lib/d").forEach { graph.addNode(it, it) }
        graph.addEdge(GraphEdge(id = "e1", source = "src/a", target = "src/b", type = EdgeType.CALL))
        graph.addEdge(GraphEdge(id = "e2", source = "src/b", target = "src/a", type = EdgeType.CALL))
        graph.addEdge(GraphEdge(id = "e3", source = "lib/c", target = "lib/d", type = EdgeType.CALL))
        graph.addEdge(GraphEdge(id = "e4", source = "lib/d", target = "lib/c", type = EdgeType.CALL))

        val srcCycles = CycleDetector(graph).detectCycles(scope = "src/")
        assertEquals(1, srcCycles.size)
    }

    @Test
    fun `classifies cross-file cycles as ERROR`() {
        val graph = DirectedGraph<String>()
        listOf("fileA::foo", "fileB::bar").forEach { graph.addNode(it, it) }
        graph.addEdge(GraphEdge(id = "e1", source = "fileA::foo", target = "fileB::bar", type = EdgeType.CALL))
        graph.addEdge(GraphEdge(id = "e2", source = "fileB::bar", target = "fileA::foo", type = EdgeType.CALL))

        val cycles = CycleDetector(graph).detectCycles(minSeverity = CycleSeverity.INFO)
        assertEquals(1, cycles.size)
        assertEquals(CycleSeverity.ERROR, cycles[0].severity)
    }

    @Test
    fun `classifies same-file cycles as WARNING`() {
        val graph = DirectedGraph<String>()
        listOf("file::foo", "file::bar").forEach { graph.addNode(it, it) }
        graph.addEdge(GraphEdge(id = "e1", source = "file::foo", target = "file::bar", type = EdgeType.CALL))
        graph.addEdge(GraphEdge(id = "e2", source = "file::bar", target = "file::foo", type = EdgeType.CALL))

        val cycles = CycleDetector(graph).detectCycles(minSeverity = CycleSeverity.INFO)
        assertEquals(1, cycles.size)
        assertEquals(CycleSeverity.WARNING, cycles[0].severity)
    }
}
