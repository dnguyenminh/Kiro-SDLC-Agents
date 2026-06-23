/**
 * KSA-161: MCP Tool registration for complexity_analysis.
 */
package com.codeintel.analyzers.complexity

import java.sql.Connection

object ComplexityTool {
    val definition = mapOf(
        "name" to "complexity_analysis",
        "description" to "Analyze cyclomatic complexity of functions with breakdown and A-F grading.",
        "inputSchema" to mapOf(
            "type" to "object",
            "properties" to mapOf(
                "file_path" to mapOf("type" to "string", "description" to "Filter by file path"),
                "symbol_name" to mapOf("type" to "string", "description" to "Filter by function/method name"),
                "min_complexity" to mapOf("type" to "number", "description" to "Minimum CC threshold"),
                "grade_filter" to mapOf("type" to "string", "description" to "Comma-separated grades (e.g. C,D,F)"),
                "module" to mapOf("type" to "string", "description" to "Filter by module name"),
                "limit" to mapOf("type" to "number", "description" to "Max results (default: 20)"),
                "sort_by" to mapOf("type" to "string", "description" to "Sort: complexity, name, file"),
            ),
        ),
    )

    fun handle(args: Map<String, Any?>, conn: Connection): String {
        val analyzer = ComplexityAnalyzer(conn)
        val gradeFilter = (args["grade_filter"] as? String)
            ?.split(",")?.mapNotNull { g ->
                try { Grade.valueOf(g.trim()) } catch (_: Exception) { null }
            }
        val filters = ComplexityFilters(
            filePath = args["file_path"] as? String,
            symbolName = args["symbol_name"] as? String,
            minComplexity = (args["min_complexity"] as? Number)?.toInt(),
            gradeFilter = gradeFilter,
            module = args["module"] as? String,
            limit = (args["limit"] as? Number)?.toInt() ?: 20,
            sortBy = when (args["sort_by"] as? String) {
                "name" -> SortBy.NAME; "file" -> SortBy.FILE; else -> SortBy.COMPLEXITY
            },
        )
        val result = analyzer.query(filters)
        if (result.results.isEmpty()) {
            return "No complexity data found. Run indexing first."
        }
        return buildString {
            appendLine("Complexity Analysis — ${result.total} functions found")
            appendLine("Average CC: ${"%.1f".format(result.summary.average)} | " +
                "Grade Distribution: ${result.summary.gradeDistribution.entries.joinToString(" ") { "${it.key}=${it.value}" }}")
            appendLine()
            for (r in result.results) {
                appendLine("[${r.grade}] ${r.symbolName} — CC=${r.cyclomaticComplexity} " +
                    "(branches=${r.branches} loops=${r.loops} logic=${r.logicalOps} " +
                    "exceptions=${r.exceptionHandlers} depth=${r.nestingDepth})")
                appendLine("    ${r.filePath}:${r.startLine}-${r.endLine}")
            }
        }
    }
}
