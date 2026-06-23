/**
 * KSA-164: Reaching Definitions — Iterative dataflow algorithm.
 */
package com.codeintel.analyzers.security.dataflow

import com.codeintel.analyzers.security.Definition
import com.codeintel.analyzers.security.cfg.BasicBlock
import com.codeintel.analyzers.security.cfg.ControlFlowGraph

class ReachingDefinitions {
    private var defCounter = 0

    fun compute(cfg: ControlFlowGraph): Map<Int, Set<Definition>> {
        val inSets = mutableMapOf<Int, MutableSet<Definition>>()
        val outSets = mutableMapOf<Int, MutableSet<Definition>>()

        for (block in cfg.blocks) {
            inSets[block.id] = mutableSetOf()
            outSets[block.id] = gen(block).toMutableSet()
        }

        var changed = true
        var iterations = 0
        val maxIterations = 100

        while (changed && iterations < maxIterations) {
            changed = false
            iterations++

            for (block in cfg.reversePostOrder()) {
                val newIn = mutableSetOf<Definition>()
                for (pred in cfg.getPredecessors(block)) {
                    outSets[pred.id]?.let { newIn.addAll(it) }
                }
                inSets[block.id] = newIn

                val genSet = gen(block)
                val newOut = genSet.toMutableSet()
                for (d in newIn) {
                    if (!kills(block, d)) newOut.add(d)
                }

                val oldOut = outSets[block.id]!!
                if (oldOut != newOut) {
                    outSets[block.id] = newOut
                    changed = true
                }
            }
        }

        return inSets
    }

    private fun gen(block: BasicBlock): Set<Definition> {
        return block.getDefinitions().map { varDef ->
            Definition(variable = varDef.name, line = varDef.line, blockId = block.id, id = defCounter++)
        }.toSet()
    }

    private fun kills(block: BasicBlock, def: Definition): Boolean {
        return block.getDefinitions().any { it.name == def.variable && it.blockId == block.id }
    }
}
