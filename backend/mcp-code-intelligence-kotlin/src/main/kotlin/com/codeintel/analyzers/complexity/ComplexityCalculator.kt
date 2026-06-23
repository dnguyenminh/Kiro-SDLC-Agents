/**
 * KSA-161: Core complexity calculation engine.
 * Delegates to language-specific counters via strategy pattern.
 */
package com.codeintel.analyzers.complexity

import com.codeintel.analyzers.complexity.counters.*
import com.codeintel.parsers.SyntaxNode

class ComplexityCalculator {
    private val counters = mutableMapOf<String, BaseNodeCounter>()

    init {
        registerCounter(TypeScriptCounter())
        registerCounter(PythonCounter())
        registerCounter(JavaCounter())
        registerCounter(KotlinCounter())
        registerCounter(GoCounter())
        counters["javascript"] = TypeScriptCounter()
    }

    fun registerCounter(counter: BaseNodeCounter) {
        counters[counter.language] = counter
    }

    fun calculate(bodyNode: SyntaxNode, language: String): ComplexityBreakdown? {
        val counter = counters[language] ?: return null
        val counts = counter.countDecisionPoints(bodyNode)
        val nestingDepth = counter.calculateNestingDepth(bodyNode)
        val earlyReturns = counter.countEarlyReturns(bodyNode)
        val cc = 1 + counts.branches + counts.loops +
            counts.logicalOps + counts.exceptionHandlers
        return ComplexityBreakdown(
            cyclomaticComplexity = cc,
            branches = counts.branches,
            loops = counts.loops,
            logicalOps = counts.logicalOps,
            exceptionHandlers = counts.exceptionHandlers,
            nestingDepth = nestingDepth,
            earlyReturns = earlyReturns,
        )
    }

    fun supportsLanguage(language: String): Boolean =
        counters.containsKey(language)

    fun getSupportedLanguages(): List<String> = counters.keys.toList()
}
