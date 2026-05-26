/**
 * KSA-164: CFG Edge — Represents control flow between basic blocks.
 */
package com.codeintel.analyzers.security.cfg

import com.codeintel.analyzers.security.EdgeType

data class CFGEdge(
    val from: BasicBlock,
    val to: BasicBlock,
    val type: EdgeType,
    val label: String? = null
) {
    override fun toString(): String = "B${from.id} -[${type}]-> B${to.id}"
}
