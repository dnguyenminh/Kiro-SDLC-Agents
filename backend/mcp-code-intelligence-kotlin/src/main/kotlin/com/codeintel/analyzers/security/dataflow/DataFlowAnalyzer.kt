/**
 * KSA-164: Data Flow Analyzer — Computes def-use chains from CFG + reaching definitions.
 */
package com.codeintel.analyzers.security.dataflow

import com.codeintel.analyzers.security.DataFlowResult
import com.codeintel.analyzers.security.DefUseChain
import com.codeintel.analyzers.security.Definition
import com.codeintel.analyzers.security.cfg.ControlFlowGraph

class DataFlowAnalyzer {
    private val reachingDefs = ReachingDefinitions()

    fun analyze(cfg: ControlFlowGraph): DataFlowResult {
        val reaching = reachingDefs.compute(cfg)
        val allDefs = collectAllDefinitions(cfg)
        val chains = buildDefUseChains(cfg, reaching, allDefs)
        return DataFlowResult(reachingDefs = reaching, defUseChains = chains, definitions = allDefs)
    }

    private fun collectAllDefinitions(cfg: ControlFlowGraph): List<Definition> {
        val defs = mutableListOf<Definition>()
        var id = 0
        for (block in cfg.blocks) {
            for (varDef in block.getDefinitions()) {
                defs.add(Definition(variable = varDef.name, line = varDef.line, blockId = block.id, id = id++))
            }
        }
        return defs
    }

    private fun buildDefUseChains(
        cfg: ControlFlowGraph,
        reaching: Map<Int, Set<Definition>>,
        allDefs: List<Definition>
    ): List<DefUseChain> {
        val chains = mutableListOf<DefUseChain>()

        for (def in allDefs) {
            val uses = mutableListOf<Map<String, Int>>()

            for (block in cfg.blocks) {
                val reachingHere = reaching[block.id] ?: continue
                val reaches = reachingHere.any {
                    it.variable == def.variable && it.line == def.line && it.blockId == def.blockId
                }
                if (!reaches) continue

                for (use in block.getUses()) {
                    if (use.name == def.variable) {
                        uses.add(mapOf("line" to use.line, "blockId" to block.id))
                    }
                }
            }

            if (uses.isNotEmpty()) {
                chains.add(DefUseChain(definition = def, uses = uses))
            }
        }

        return chains
    }
}
