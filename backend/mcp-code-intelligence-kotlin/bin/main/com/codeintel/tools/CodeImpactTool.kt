/** code_impact tool — blast radius prediction for symbol changes. KSA-171. */
package com.codeintel.tools

import com.codeintel.graph.ImpactAnalysisService
import com.codeintel.graph.models.ImpactAction
import com.codeintel.graph.models.ImpactResult
import com.codeintel.graph.models.Severity
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive

class CodeImpactTool(private val impactService: ImpactAnalysisService) {

    fun execute(args: JsonObject): String {
        val symbol = args["symbol"]?.jsonPrimitive?.content
            ?: return """{"error":"Parameter \"symbol\" is required"}"""

        val action = parseAction(args["action"]?.jsonPrimitive?.content ?: "modify")
        val depth = args["depth"]?.jsonPrimitive?.int ?: 3
        val includeTests = args["include_tests"]?.jsonPrimitive?.boolean ?: true
        val threshold = parseSeverity(args["severity_threshold"]?.jsonPrimitive?.content ?: "low")

        val result = impactService.analyzeImpact(symbol, action, depth, includeTests, threshold)
        return formatResult(result)
    }

    private fun parseAction(value: String): ImpactAction = when (value) {
        "delete" -> ImpactAction.DELETE
        "rename" -> ImpactAction.RENAME
        else -> ImpactAction.MODIFY
    }

    private fun parseSeverity(value: String): Severity = when (value) {
        "critical" -> Severity.CRITICAL
        "high" -> Severity.HIGH
        "medium" -> Severity.MEDIUM
        else -> Severity.LOW
    }

    private fun formatResult(result: ImpactResult): String {
        val lines = mutableListOf<String>()
        lines.add("Impact Analysis: \"${result.symbol}\" (${result.action.value})\n")

        val br = result.blastRadius
        lines.add("Blast Radius:")
        lines.add("  Critical: ${br.summary["critical"] ?: 0}")
        lines.add("  High: ${br.summary["high"] ?: 0}")
        lines.add("  Medium: ${br.summary["medium"] ?: 0}")
        lines.add("  Low: ${br.summary["low"] ?: 0}")
        lines.add("  Total affected: ${br.totalAffected} (${br.affectedFiles} files)")
        lines.add("  Affected tests: ${br.affectedTests}\n")

        if (result.impacts.isNotEmpty()) {
            lines.add("Impacts:")
            for (impact in result.impacts.take(30)) {
                val icon = if (impact.severity == Severity.CRITICAL) "!!" else if (impact.severity == Severity.HIGH) "!" else "-"
                lines.add("  $icon [${impact.severity.value}] ${impact.symbol}")
                lines.add("    ${impact.file}:${impact.line} - ${impact.reason}")
            }
            if (result.impacts.size > 30) lines.add("  ... and ${result.impacts.size - 30} more")
            lines.add("")
        }

        if (result.affectedTests.isNotEmpty()) {
            lines.add("Affected Tests:")
            for (test in result.affectedTests.take(10)) {
                lines.add("  - ${test.file} (${test.reason})")
            }
            lines.add("")
        }

        if (result.recommendations.isNotEmpty()) {
            lines.add("Recommendations:")
            for (rec in result.recommendations) lines.add("  * $rec")
            lines.add("")
        }

        val ms = result.metadata["queryTimeMs"] ?: 0
        val d = result.metadata["depthSearched"] ?: 0
        val trunc = result.metadata["truncated"] ?: false
        lines.add("--- ${ms}ms | depth $d${if (trunc == true) " | TRUNCATED" else ""}")
        return lines.joinToString("\n")
    }
}
