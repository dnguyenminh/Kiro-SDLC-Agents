/**
 * KSA-165: Injection Scanner — Main orchestrator for injection detection.
 */
package com.codeintel.analyzers.security.injection

import com.codeintel.analyzers.security.*
import com.codeintel.analyzers.security.injection.patterns.*
import com.codeintel.analyzers.security.taint.TaintAnalyzer
import com.codeintel.parsers.SyntaxNode

class InjectionScanner(taintAnalyzer: TaintAnalyzer? = null) {
    private val taintAnalyzer = taintAnalyzer ?: TaintAnalyzer()
    private val suppressionChecker = SuppressionChecker()
    private val matchers: List<PatternMatcher> = listOf(
        SQLInjectionMatcher(), XSSMatcher(), CommandInjectionMatcher(),
        PathTraversalMatcher(), DeserializationMatcher(), LDAPXMLMatcher()
    )

    fun scanFunction(
        functionNode: SyntaxNode, filePath: String, language: String,
        sourceLines: List<String>, functionName: String? = null
    ): List<Finding> {
        val taintResult = taintAnalyzer.analyze(functionNode, language)
        if (taintResult.paths.isEmpty()) return emptyList()

        val context = MatchContext(filePath, functionName ?: "anonymous", language)
        val findings = mutableListOf<Finding>()

        for (path in taintResult.paths) {
            for (matcher in matchers) {
                val finding = matcher.match(path, context)
                if (finding != null) {
                    val suppression = suppressionChecker.isSuppressed(sourceLines, path.sink.line)
                    if (suppression != null) {
                        finding.suppressed = true
                        finding.suppressionInfo = suppression
                    }
                    findings.add(finding)
                    break
                }
            }
        }
        return findings
    }

    fun scanFunctions(
        functions: List<Pair<SyntaxNode, String>>, filePath: String,
        language: String, sourceLines: List<String>, options: ScanOptions = ScanOptions()
    ): ScanResult {
        val startTime = System.currentTimeMillis()
        val allFindings = mutableListOf<Finding>()
        val suppressed = mutableListOf<Finding>()

        if (suppressionChecker.isFileSuppressed(sourceLines)) {
            return emptyResult(1, System.currentTimeMillis() - startTime)
        }

        for ((node, name) in functions) {
            val findings = scanFunction(node, filePath, language, sourceLines, name)
            for (finding in findings) {
                if (options.severityThreshold != null && finding.severity.ordinal > options.severityThreshold!!.ordinal) continue
                if (options.categories != null && finding.category !in options.categories!!) continue
                if (finding.suppressed) suppressed.add(finding) else allFindings.add(finding)
            }
        }

        val duration = System.currentTimeMillis() - startTime
        return ScanResult(
            findings = allFindings,
            suppressed = if (options.includeSuppressed) suppressed else emptyList(),
            summary = mapOf(
                "total" to allFindings.size,
                "bySeverity" to Severity.entries.associateWith { s -> allFindings.count { it.severity == s } },
                "byCategory" to allFindings.groupBy { it.category }.mapValues { it.value.size },
                "filesScanned" to 1,
                "scanDuration" to duration
            )
        )
    }

    private fun emptyResult(filesScanned: Int, duration: Long) = ScanResult(
        findings = emptyList(), suppressed = emptyList(),
        summary = mapOf("total" to 0, "bySeverity" to Severity.entries.associateWith { 0 }, "byCategory" to emptyMap<String, Int>(), "filesScanned" to filesScanned, "scanDuration" to duration)
    )
}
