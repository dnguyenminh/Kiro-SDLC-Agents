/**
 * KSA-161: TypeScript/JavaScript AST node counter.
 */
package com.codeintel.analyzers.complexity.counters

import com.codeintel.analyzers.complexity.BaseNodeCounter

class TypeScriptCounter : BaseNodeCounter() {
    override val language = "typescript"
    override val branchNodeTypes = setOf(
        "if_statement", "switch_case", "ternary_expression",
        "conditional_expression",
    )
    override val loopNodeTypes = setOf(
        "for_statement", "for_in_statement", "while_statement",
        "do_statement",
    )
    override val logicalOperators = setOf("&&", "||", "??")
    override val exceptionNodeTypes = setOf("catch_clause")
}
