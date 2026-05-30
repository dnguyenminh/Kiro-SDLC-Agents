/**
 * KSA-161: Java AST node counter.
 */
package com.codeintel.analyzers.complexity.counters

import com.codeintel.analyzers.complexity.BaseNodeCounter

class JavaCounter : BaseNodeCounter() {
    override val language = "java"
    override val branchNodeTypes = setOf(
        "if_statement", "switch_expression", "ternary_expression",
    )
    override val loopNodeTypes = setOf(
        "for_statement", "enhanced_for_statement",
        "while_statement", "do_statement",
    )
    override val logicalOperators = setOf("&&", "||")
    override val exceptionNodeTypes = setOf("catch_clause")
}
