/**
 * KSA-161: Abstract base for language-specific AST node counters.
 */
package com.codeintel.analyzers.complexity

import com.codeintel.parsers.SyntaxNode
import com.codeintel.parsers.walkTree

abstract class BaseNodeCounter {
    abstract val language: String
    abstract val branchNodeTypes: Set<String>
    abstract val loopNodeTypes: Set<String>
    abstract val logicalOperators: Set<String>
    abstract val exceptionNodeTypes: Set<String>

    fun countDecisionPoints(node: SyntaxNode): DecisionPointCounts {
        var branches = 0; var loops = 0
        var logicOps = 0; var exceptions = 0
        walkTree(node) { child ->
            when {
                child.type in branchNodeTypes -> branches++
                child.type in loopNodeTypes -> loops++
                child.type in exceptionNodeTypes -> exceptions++
            }
            if (isLogicalOp(child)) logicOps++
            true
        }
        return DecisionPointCounts(branches, loops, logicOps, exceptions)
    }

    fun calculateNestingDepth(node: SyntaxNode): Int {
        val controlTypes = branchNodeTypes + loopNodeTypes
        var maxDepth = 0
        fun walk(n: SyntaxNode, depth: Int) {
            val d = if (n.type in controlTypes) depth + 1 else depth
            if (d > maxDepth) maxDepth = d
            for (i in 0 until n.childCount) {
                n.child(i)?.let { walk(it, d) }
            }
        }
        walk(node, 0)
        return maxDepth
    }

    fun countEarlyReturns(node: SyntaxNode): Int {
        var count = 0
        val returnTypes = getReturnNodeTypes()
        walkTree(node) { child ->
            if (child.type in returnTypes) count++
            true
        }
        return maxOf(0, count - 1)
    }

    protected open fun isLogicalOp(node: SyntaxNode): Boolean {
        if (node.type in setOf("binary_expression", "logical_expression")) {
            val op = node.childByFieldName("operator")
            if (op != null && op.text in logicalOperators) return true
        }
        return false
    }

    protected open fun getReturnNodeTypes(): Set<String> =
        setOf("return_statement")
}
