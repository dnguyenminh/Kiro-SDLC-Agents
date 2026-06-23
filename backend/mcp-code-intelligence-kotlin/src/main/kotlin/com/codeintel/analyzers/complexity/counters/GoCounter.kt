/**
 * KSA-161: Go AST node counter.
 */
package com.codeintel.analyzers.complexity.counters

import com.codeintel.analyzers.complexity.BaseNodeCounter

class GoCounter : BaseNodeCounter() {
    override val language = "go"
    override val branchNodeTypes = setOf(
        "if_statement", "expression_case", "type_case",
    )
    override val loopNodeTypes = setOf("for_statement")
    override val logicalOperators = setOf("&&", "||")
    override val exceptionNodeTypes = setOf("defer_statement")
}
