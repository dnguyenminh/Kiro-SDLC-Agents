package com.codeintel.analyzers.graphanalysis.utils

import com.codeintel.analyzers.graphanalysis.AdjacencyList
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class TarjanSCCTest {
    private val tarjan = TarjanSCC()

    @Test fun `finds simple cycle`() {
        val graph: AdjacencyList = mutableMapOf(
            1 to mutableListOf(2),
            2 to mutableListOf(1),
        )
        val sccs = tarjan.findSCCs(graph)
        assertEquals(1, sccs.size)
        assertEquals(2, sccs[0].size)
        assertTrue(sccs[0].containsAll(listOf(1, 2)))
    }

    @Test fun `no cycle in DAG`() {
        val graph: AdjacencyList = mutableMapOf(
            1 to mutableListOf(2),
            2 to mutableListOf(3),
            3 to mutableListOf(),
        )
        val sccs = tarjan.findSCCs(graph)
        assertTrue(sccs.isEmpty())
    }

    @Test fun `finds triangle cycle`() {
        val graph: AdjacencyList = mutableMapOf(
            1 to mutableListOf(2),
            2 to mutableListOf(3),
            3 to mutableListOf(1),
        )
        val sccs = tarjan.findSCCs(graph)
        assertEquals(1, sccs.size)
        assertEquals(3, sccs[0].size)
    }

    @Test fun `multiple SCCs`() {
        val graph: AdjacencyList = mutableMapOf(
            1 to mutableListOf(2),
            2 to mutableListOf(1),
            3 to mutableListOf(4),
            4 to mutableListOf(3),
        )
        val sccs = tarjan.findSCCs(graph)
        assertEquals(2, sccs.size)
    }
}
