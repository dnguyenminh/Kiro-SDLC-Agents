/**
 * KSA-163: MCP Tool registrations for graph analysis tools.
 */
package com.codeintel.analyzers.graphanalysis

import com.codeintel.analyzers.graphanalysis.utils.GraphLoader
import java.sql.Connection

object GraphAnalysisTools {
    val definitions = listOf(
        mapOf("name" to "find_circular_deps", "description" to "Find circular dependencies using Tarjan's SCC.",
            "inputSchema" to mapOf("type" to "object", "properties" to mapOf(
                "module" to mapOf("type" to "string", "description" to "Filter by module"),
                "max_length" to mapOf("type" to "number", "description" to "Max cycle length"),
            ))),
        mapOf("name" to "find_related_tests", "description" to "Find tests for a symbol via reverse BFS.",
            "inputSchema" to mapOf("type" to "object", "properties" to mapOf(
                "symbol_name" to mapOf("type" to "string", "description" to "Symbol name"),
                "file_path" to mapOf("type" to "string", "description" to "File path to disambiguate"),
                "max_depth" to mapOf("type" to "number", "description" to "Max depth (default: 3)"),
            ), "required" to listOf("symbol_name"))),
        mapOf("name" to "find_hot_paths", "description" to "Find most-called functions by transitive callers.",
            "inputSchema" to mapOf("type" to "object", "properties" to mapOf(
                "module" to mapOf("type" to "string", "description" to "Filter by module"),
                "limit" to mapOf("type" to "number", "description" to "Max results (default: 20)"),
                "min_callers" to mapOf("type" to "number", "description" to "Min direct callers (default: 2)"),
            ))),
        mapOf("name" to "find_dead_imports", "description" to "Find unused/dead imports.",
            "inputSchema" to mapOf("type" to "object", "properties" to mapOf(
                "file_path" to mapOf("type" to "string", "description" to "Filter by file"),
                "module" to mapOf("type" to "string", "description" to "Filter by module"),
                "limit" to mapOf("type" to "number", "description" to "Max results (default: 50)"),
            ))),
        mapOf("name" to "module_summary", "description" to "Quality summary: circular deps, hot paths, dead imports, avg complexity.",
            "inputSchema" to mapOf("type" to "object", "properties" to mapOf(
                "module" to mapOf("type" to "string", "description" to "Module name (omit for all)"),
            ))),
    )

    fun handle(name: String, args: Map<String, Any?>, conn: Connection): String? {
        val graphLoader = GraphLoader(conn)
        return when (name) {
            "find_circular_deps" -> handleCircularDeps(args, graphLoader)
            "find_related_tests" -> handleRelatedTests(args, graphLoader)
            "find_hot_paths" -> handleHotPaths(args, graphLoader)
            "find_dead_imports" -> handleDeadImports(args, conn)
            "module_summary" -> handleModuleSummary(args, conn)
            else -> null
        }
    }

    private fun handleCircularDeps(args: Map<String, Any?>, gl: GraphLoader): String {
        val results = CircularDepDetector(gl).detect(CircularDepOptions(
            module = args["module"] as? String,
            maxLength = (args["max_length"] as? Number)?.toInt(),
        ))
        if (results.isEmpty()) return "No circular dependencies found."
        return buildString {
            appendLine("Found ${results.size} circular dependencies:")
            for (dep in results) {
                appendLine("[${dep.severity.uppercase()}] Cycle (length ${dep.length}):")
                appendLine("  ${dep.cycle.edges.joinToString(" → ")}")
                for (node in dep.cycle.nodes) appendLine("    - ${node.name} (${node.kind}) — ${node.filePath}")
            }
        }
    }

    private fun handleRelatedTests(args: Map<String, Any?>, gl: GraphLoader): String {
        val symbolName = args["symbol_name"] as? String ?: return "Parameter 'symbol_name' required."
        val result = RelatedTestFinder(gl).find(symbolName,
            maxDepth = (args["max_depth"] as? Number)?.toInt() ?: 3,
            filePath = args["file_path"] as? String,
        ) ?: return "Symbol \"$symbolName\" not found."
        if (result.totalTests == 0) return "No tests found for \"$symbolName\"."
        return buildString {
            appendLine("Tests for ${result.symbol.name} (${result.symbol.filePath}):")
            appendLine("Direct tests (${result.directTests.size}):")
            for (t in result.directTests) appendLine("  ✓ ${t.testName} — ${t.filePath}")
            if (result.indirectTests.isNotEmpty()) {
                appendLine("Indirect tests (${result.indirectTests.size}):")
                for (t in result.indirectTests) {
                    appendLine("  ○ ${t.testName} — ${t.filePath} (depth: ${t.depth})")
                    appendLine("    Chain: ${t.path.joinToString(" → ")}")
                }
            }
        }
    }

    private fun handleHotPaths(args: Map<String, Any?>, gl: GraphLoader): String {
        val results = HotPathAnalyzer(gl).analyze(
            module = args["module"] as? String,
            limit = (args["limit"] as? Number)?.toInt() ?: 20,
            minCallers = (args["min_callers"] as? Number)?.toInt() ?: 2,
        )
        if (results.isEmpty()) return "No hot paths found."
        return buildString {
            appendLine("Hot Paths — Top ${results.size} most-called functions:")
            results.forEachIndexed { i, hp ->
                appendLine("${i + 1}. ${hp.symbolName} (${hp.kind}) — ${hp.directCallers} direct, ${hp.transitiveCallers} transitive")
                appendLine("   ${hp.filePath}")
            }
        }
    }

    private fun handleDeadImports(args: Map<String, Any?>, conn: Connection): String {
        val results = DeadImportDetector(conn).detect(
            filePath = args["file_path"] as? String,
            module = args["module"] as? String,
            limit = (args["limit"] as? Number)?.toInt() ?: 50,
        )
        if (results.isEmpty()) return "No dead imports found."
        return buildString {
            appendLine("Found ${results.size} potentially unused imports:")
            for (imp in results) appendLine("  ${imp.filePath}:${imp.line} — ${imp.importedSymbol}${if (imp.fromModule.isNotEmpty()) " from \"${imp.fromModule}\"" else ""}")
        }
    }

    private fun handleModuleSummary(args: Map<String, Any?>, conn: Connection): String {
        val results = ModuleSummarizer(conn).summarize(args["module"] as? String)
        if (results.isEmpty()) return "No modules found."
        return buildString {
            appendLine("Module Quality Summary (${results.size} modules):")
            for (mod in results) {
                appendLine("📦 ${mod.module}")
                appendLine("   Files: ${mod.fileCount} | Symbols: ${mod.symbolCount}")
                appendLine("   Circular Deps: ${mod.circularDeps} | Dead Imports: ${mod.deadImports}")
                appendLine("   Avg Complexity: ${mod.avgComplexity?.let { "%.1f".format(it) } ?: "N/A"}")
                if (mod.hotPaths.isNotEmpty()) appendLine("   Hot Paths: ${mod.hotPaths.joinToString(", ") { it.symbolName }}")
            }
        }
    }
}
