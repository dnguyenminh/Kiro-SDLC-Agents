package com.codeintel.analyzers.similarity

import kotlin.test.Test
import kotlin.test.assertEquals

class MockCallGraph(private val edges: Map<String, List<String>>) : CallGraph {
    override fun getCallees(nodeId: String) = edges[nodeId] ?: emptyList()
    override fun getCallers(nodeId: String) = emptyList<String>()
}

class ReachabilityAnalyzerTest {

    @Test
    fun `simple reachability`() {
        val graph = MockCallGraph(mapOf("main" to listOf("a", "b"), "a" to listOf("c")))
        val analyzer = ReachabilityAnalyzer(graph, listOf("main"))
        assertEquals(setOf("main", "a", "b", "c"), analyzer.computeReachable())
    }

    @Test
    fun `unreachable nodes`() {
        val graph = MockCallGraph(mapOf("main" to listOf("a")))
        val analyzer = ReachabilityAnalyzer(graph, listOf("main"))
        val unreachable = analyzer.getUnreachable(listOf("main", "a", "b", "c"))
        assertEquals(setOf("b", "c"), unreachable.toSet())
    }

    @Test
    fun `cycle handling`() {
        val graph = MockCallGraph(mapOf("a" to listOf("b"), "b" to listOf("a")))
        val analyzer = ReachabilityAnalyzer(graph, listOf("a"))
        assertEquals(setOf("a", "b"), analyzer.computeReachable())
    }

    @Test
    fun `empty graph`() {
        val graph = MockCallGraph(emptyMap())
        val analyzer = ReachabilityAnalyzer(graph, listOf("main"))
        assertEquals(setOf("main"), analyzer.computeReachable())
    }
}
