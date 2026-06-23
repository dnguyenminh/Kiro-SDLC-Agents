/** Union-Find clustering for grouping near-duplicate code. */
package com.codeintel.analyzers.similarity

import com.codeintel.analyzers.similarity.models.Cluster

/**
 * Build duplicate clusters using Union-Find with path compression
 * and union by rank.
 */
class ClusterBuilder {
    private val parent = mutableMapOf<String, String>()
    private val rank = mutableMapOf<String, Int>()

    /** Merge two nodes into the same cluster. */
    fun union(a: String, b: String) {
        val rootA = find(a)
        val rootB = find(b)
        if (rootA == rootB) return
        mergeByRank(rootA, rootB)
    }

    /** Find cluster representative with path compression. */
    fun find(x: String): String {
        if (x !in parent) {
            parent[x] = x
            rank[x] = 0
        }
        if (parent[x] != x) {
            parent[x] = find(parent[x]!!)
        }
        return parent[x]!!
    }

    /** Return all clusters with 2+ members. */
    fun getClusters(): List<Cluster> {
        val groups = mutableMapOf<String, MutableList<String>>()
        for (node in parent.keys) {
            val root = find(node)
            groups.getOrPut(root) { mutableListOf() }.add(node)
        }
        return groups
            .filter { it.value.size >= 2 }
            .map { (root, members) -> Cluster(root, members.sorted()) }
    }

    private fun mergeByRank(rootA: String, rootB: String) {
        val rankA = rank.getOrDefault(rootA, 0)
        val rankB = rank.getOrDefault(rootB, 0)
        when {
            rankA < rankB -> parent[rootA] = rootB
            rankA > rankB -> parent[rootB] = rootA
            else -> {
                parent[rootB] = rootA
                rank[rootA] = rankA + 1
            }
        }
    }
}
