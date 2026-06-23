/**
 * KSA-161: Python AST node counter.
 */
package com.codeintel.analyzers.complexity.counters

import com.codeintel.analyzers.complexity.BaseNodeCounter

class PythonCounter : BaseNodeCounter() {
    override val language = "python"
    override val branchNodeTypes = setOf(
        "if_statement", "elif_clause", "conditional_expression",
    )
    override val loopNodeTypes = setOf(
        "for_statement", "while_statement",
    )
    override val logicalOperators = setOf("and", "or")
    override val exceptionNodeTypes = setOf("except_clause")

    override fun getReturnNodeTypes(): Set<String> =
        setOf("return_statement")
}
