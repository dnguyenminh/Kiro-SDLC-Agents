/**
 * KSA-164: Control Flow Graph — Container for basic blocks and edges.
 */
package com.codeintel.analyzers.security.cfg

import com.codeintel.analyzers.security.EdgeType

class ControlFlowGraph(val entry: BasicBlock) {
    val exits: MutableList<BasicBlock> = mutableListOf()
    val blocks: MutableList<BasicBlock> = mutableListOf()
    val edges: MutableList<CFGEdge> = mutableListOf()
    private val adjacency: MutableMap<Int, MutableList<CFGEdge>> = mutableMapOf()
    private val reverseAdj: MutableMap<Int, MutableList<CFGEdge>> = mutableMapOf()

    init {
        addBlock(entry)
    }

    fun addBlock(block: BasicBlock) {
        blocks.add(block)
        adjacency[block.id] = mutableListOf()
        reverseAdj[block.id] = mutableListOf()
        if (block.type == com.codeintel.analyzers.security.BlockType.EXIT) exits.add(block)
    }

    fun addEdge(from: BasicBlock, to: BasicBlock, type: EdgeType, label: String? = null): CFGEdge {
        val edge = CFGEdge(from, to, type, label)
        edges.add(edge)
        adjacency[from.id]!!.add(edge)
        reverseAdj[to.id]!!.add(edge)
        return edge
    }

    fun getSuccessors(block: BasicBlock): List<BasicBlock> =
        adjacency[block.id]?.map { it.to } ?: emptyList()

    fun getPredecessors(block: BasicBlock): List<BasicBlock> =
        reverseAdj[block.id]?.map { it.from } ?: emptyList()

    fun getOutEdges(block: BasicBlock): List<CFGEdge> =
        adjacency[block.id] ?: emptyList()

    fun getInEdges(block: BasicBlock): List<CFGEdge> =
        reverseAdj[block.id] ?: emptyList()

    fun topologicalOrder(): List<BasicBlock> {
        val visited = mutableSetOf<Int>()
        val result = mutableListOf<BasicBlock>()

        fun dfs(block: BasicBlock) {
            if (block.id in visited) return
            visited.add(block.id)
            for (succ in getSuccessors(block)) dfs(succ)
            result.add(0, block)
        }

        dfs(entry)
        return result
    }

    fun reversePostOrder(): List<BasicBlock> {
        val visited = mutableSetOf<Int>()
        val postOrder = mutableListOf<BasicBlock>()

        fun dfs(block: BasicBlock) {
            if (block.id in visited) return
            visited.add(block.id)
            for (succ in getSuccessors(block)) dfs(succ)
            postOrder.add(block)
        }

        dfs(entry)
        return postOrder.reversed()
    }

    fun getBlock(id: Int): BasicBlock? = blocks.find { it.id == id }

    override fun toString(): String {
        val lines = mutableListOf("CFG: ${blocks.size} blocks, ${edges.size} edges")
        for (edge in edges) lines.add("  $edge")
        return lines.joinToString("\n")
    }
}
