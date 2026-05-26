package com.codeintel.analyzers.similarity

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ClusterBuilderTest {

    @Test
    fun `empty builder returns no clusters`() {
        val cb = ClusterBuilder()
        assertEquals(emptyList(), cb.getClusters())
    }

    @Test
    fun `single union creates one cluster`() {
        val cb = ClusterBuilder()
        cb.union("a", "b")
        val clusters = cb.getClusters()
        assertEquals(1, clusters.size)
        assertEquals(setOf("a", "b"), clusters[0].members.toSet())
    }

    @Test
    fun `transitive union merges into one cluster`() {
        val cb = ClusterBuilder()
        cb.union("a", "b")
        cb.union("b", "c")
        val clusters = cb.getClusters()
        assertEquals(1, clusters.size)
        assertEquals(setOf("a", "b", "c"), clusters[0].members.toSet())
    }

    @Test
    fun `separate clusters remain separate`() {
        val cb = ClusterBuilder()
        cb.union("a", "b")
        cb.union("c", "d")
        assertEquals(2, cb.getClusters().size)
    }

    @Test
    fun `find with path compression`() {
        val cb = ClusterBuilder()
        cb.union("a", "b")
        cb.union("b", "c")
        cb.union("c", "d")
        val root = cb.find("d")
        assertEquals(root, cb.find("a"))
        assertEquals(root, cb.find("b"))
        assertEquals(root, cb.find("c"))
    }
}
