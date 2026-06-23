/**
 * KSA-161: Kotlin AST node counter.
 */
package com.codeintel.analyzers.complexity.counters

import com.codeintel.analyzers.complexity.BaseNodeCounter

class KotlinCounter : BaseNodeCounter() {
    override val language = "kotlin"
    override val branchNodeTypes = setOf(
        "if_expression", "when_entry", "elvis_expression",
    )
    override val loopNodeTypes = setOf(
        "for_statement", "while_statement", "do_while_statement",
    )
    override val logicalOperators = setOf("&&", "||")
    override val exceptionNodeTypes = setOf("catch_block")

    override fun getReturnNodeTypes(): Set<String> =
        setOf("jump_expression") // Kotlin uses jump_expression for return
}
