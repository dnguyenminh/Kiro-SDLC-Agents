/**
 * KSA-165: Pattern Matcher — Base class for injection pattern matching.
 */
package com.codeintel.analyzers.security.injection

import com.codeintel.analyzers.security.*

data class MatchContext(val filePath: String, val functionName: String, val language: String)

abstract class PatternMatcher {
    abstract val category: String
    abstract val patterns: List<InjectionPattern>

    fun match(taintPath: TaintPath, context: MatchContext): Finding? {
        for (pattern in patterns) {
            if (matchesSink(taintPath.sink.function, pattern) &&
                hasDangerousOp(taintPath, pattern.dangerousOps) &&
                !hasSafePattern(taintPath, pattern.safePatterns)) {
                return createFinding(taintPath, pattern, context)
            }
        }
        return null
    }

    private fun matchesSink(sinkFunction: String, pattern: InjectionPattern): Boolean =
        pattern.sinkPatterns.any { it in sinkFunction }

    private fun hasDangerousOp(path: TaintPath, dangerousOps: List<String>): Boolean {
        if (dangerousOps.isEmpty()) return true
        return path.chain.any { it.action.name.lowercase() in dangerousOps }
    }

    private fun hasSafePattern(path: TaintPath, safePatterns: List<String>): Boolean {
        if (safePatterns.isEmpty()) return false
        val sinkExpr = path.sink.expression
        if (safePatterns.any { it in sinkExpr }) return true
        return path.chain.any { it.action == TaintStepAction.SANITIZE }
    }

    private fun createFinding(path: TaintPath, pattern: InjectionPattern, context: MatchContext): Finding {
        val confidence = if (path.length <= 3) Confidence.HIGH else if (path.length <= 6) Confidence.MEDIUM else Confidence.LOW
        return Finding(
            id = "${pattern.category.uppercase()}-${pattern.id}-${context.filePath}:${path.sink.line}",
            ruleId = "INJ-${pattern.category.uppercase()}-${pattern.id.toString().padStart(3, '0')}",
            category = pattern.category,
            pattern = pattern,
            taintPath = path,
            severity = pattern.severity,
            confidence = confidence,
            cwe = pattern.cwe,
            message = "${pattern.name}: Tainted data from ${path.source.type} flows to ${path.sink.function} without sanitization",
            remediation = pattern.description,
            location = mapOf("file" to context.filePath, "startLine" to path.source.line, "endLine" to path.sink.line)
        )
    }
}
