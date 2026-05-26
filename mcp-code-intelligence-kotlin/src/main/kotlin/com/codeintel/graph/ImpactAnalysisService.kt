/** Impact Analysis Service — blast radius prediction. KSA-173. */
package com.codeintel.graph

import com.codeintel.graph.models.*
import java.sql.Connection

class ImpactAnalysisService(
    private val conn: Connection,
    private val callGraph: CallGraphService,
    private val depGraph: DependencyGraphService,
    private val resolver: SymbolResolver,
    private val testDetector: TestDetector,
) {

    /** Analyze the impact of modifying/deleting/renaming a symbol. */
    fun analyzeImpact(
        symbolName: String,
        action: ImpactAction = ImpactAction.MODIFY,
        depth: Int = 3,
        includeTests: Boolean = true,
        severityThreshold: Severity = Severity.LOW,
    ): ImpactResult {
        val startTime = System.currentTimeMillis()
        val clampedDepth = depth.coerceIn(1, 5)

        val resolved = resolver.resolve(symbolName)
        if (resolved.isEmpty()) return emptyResult(symbolName, action)

        val impacts = mutableListOf<ImpactItem>()
        val sourceFile = resolved.first().filePath

        // 1. Find callers
        val callerResult = callGraph.findCallers(symbolName, clampedDepth, 100)
        for (caller in callerResult.results) {
            val severity = classifySeverity(caller.depthLevel, action)
            val reason = if (caller.depthLevel == 1) "Direct caller" else "Transitive caller (depth ${caller.depthLevel})"
            impacts.add(ImpactItem(caller.symbol, caller.filePath, caller.callSiteLine, severity, reason, caller.qualifiedName))
        }

        // 2. Find interface implementors
        impacts.addAll(findImplementorImpacts(resolved, symbolName))

        // 3. Find file-level dependents
        val depResult = depGraph.query(sourceFile, "incoming", minOf(clampedDepth, 2), false, 50)
        for (dep in depResult.results) {
            if (impacts.none { it.file == dep.file }) {
                val sev = if (action == ImpactAction.DELETE) Severity.HIGH else Severity.MEDIUM
                impacts.add(ImpactItem(dep.file, dep.file, 0, sev, "Imports modified file"))
            }
        }

        // 4. Find related tests
        var affectedTests = emptyList<RelatedTest>()
        if (includeTests) {
            affectedTests = testDetector.findRelatedTests(resolved, impacts.map { it.file })
            for (test in affectedTests) {
                if (impacts.none { it.file == test.file }) {
                    impacts.add(ImpactItem(test.file, test.file, 0, Severity.HIGH, test.reason))
                }
            }
        }

        // 5. Filter, deduplicate, sort
        val filtered = filterBySeverity(impacts, severityThreshold)
        val deduped = deduplicate(filtered).sortedBy { Severity.order(it.severity) }

        // 6. Recommendations
        val recommendations = ImpactRecommendations.generate(deduped, action, symbolName, testDetector)

        // 7. Summary
        val summary = buildSummary(deduped)
        val affectedFiles = deduped.map { it.file }.toSet().size
        val elapsed = System.currentTimeMillis() - startTime

        return ImpactResult(
            symbol = symbolName,
            action = action,
            blastRadius = BlastRadius(summary, deduped.size, affectedFiles, affectedTests.size),
            impacts = deduped,
            affectedTests = affectedTests,
            recommendations = recommendations,
            metadata = mapOf("queryTimeMs" to elapsed, "depthSearched" to clampedDepth, "truncated" to callerResult.metadata.truncated),
        )
    }

    private fun classifySeverity(depth: Int, action: ImpactAction): Severity = when {
        action == ImpactAction.DELETE && depth <= 1 -> Severity.CRITICAL
        action == ImpactAction.DELETE && depth <= 2 -> Severity.HIGH
        action == ImpactAction.DELETE -> Severity.MEDIUM
        action == ImpactAction.RENAME && depth <= 1 -> Severity.HIGH
        depth == 1 -> Severity.CRITICAL
        depth == 2 -> Severity.HIGH
        depth == 3 -> Severity.MEDIUM
        else -> Severity.LOW
    }

    private fun findImplementorImpacts(resolved: List<ResolvedSymbol>, symbolName: String): List<ImpactItem> {
        val impacts = mutableListOf<ImpactItem>()
        for (sym in resolved) {
            if (sym.kind != "method" || sym.parentSymbolId == null) continue
            val parentStmt = conn.prepareStatement("SELECT kind, name FROM symbols WHERE id = ?")
            parentStmt.setInt(1, sym.parentSymbolId)
            val parentRs = parentStmt.executeQuery()
            if (!parentRs.next() || parentRs.getString("kind") != "interface") continue
            val parentName = parentRs.getString("name")

            val implStmt = conn.prepareStatement("""
                SELECT DISTINCT s.name, f.relative_path, s.start_line
                FROM relationships r JOIN symbols s ON s.id = r.source_symbol_id JOIN files f ON s.file_id = f.id
                WHERE r.target_symbol = ? AND r.kind = 'implements'
            """.trimIndent())
            implStmt.setString(1, parentName)
            val implRs = implStmt.executeQuery()
            while (implRs.next()) {
                impacts.add(ImpactItem(
                    "${implRs.getString(1)}.${sym.name}", implRs.getString(2),
                    implRs.getInt(3), Severity.CRITICAL, "Implements $parentName.${sym.name}",
                ))
            }
        }
        return impacts
    }

    private fun filterBySeverity(impacts: List<ImpactItem>, threshold: Severity): List<ImpactItem> {
        val thresholdOrder = Severity.order(threshold)
        return impacts.filter { Severity.order(it.severity) <= thresholdOrder }
    }

    private fun deduplicate(impacts: List<ImpactItem>): List<ImpactItem> {
        val seen = mutableSetOf<String>()
        return impacts.filter { seen.add("${it.file}:${it.symbol}:${it.line}") }
    }

    private fun buildSummary(impacts: List<ImpactItem>): Map<String, Int> {
        val summary = mutableMapOf("critical" to 0, "high" to 0, "medium" to 0, "low" to 0)
        for (i in impacts) summary[i.severity.value] = (summary[i.severity.value] ?: 0) + 1
        return summary
    }

    private fun emptyResult(symbolName: String, action: ImpactAction) = ImpactResult(
        symbol = symbolName, action = action,
        recommendations = listOf("Symbol \"$symbolName\" not found in index"),
        metadata = mapOf("queryTimeMs" to 0L, "depthSearched" to 0, "truncated" to false),
    )
}
