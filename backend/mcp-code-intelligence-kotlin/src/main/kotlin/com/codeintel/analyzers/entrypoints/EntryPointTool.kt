/**
 * KSA-162: MCP Tool registration for find_entry_points.
 */
package com.codeintel.analyzers.entrypoints

import java.sql.Connection

object EntryPointTool {
    val definition = mapOf(
        "name" to "find_entry_points",
        "description" to "Find HTTP handlers, main functions, CLI commands, and event handlers.",
        "inputSchema" to mapOf(
            "type" to "object",
            "properties" to mapOf(
                "entry_type" to mapOf("type" to "string", "description" to "Filter: HTTP_HANDLER, MAIN, CLI_COMMAND, EVENT_HANDLER, SCHEDULED"),
                "framework" to mapOf("type" to "string", "description" to "Filter by framework"),
                "http_method" to mapOf("type" to "string", "description" to "Filter by HTTP method"),
                "route_pattern" to mapOf("type" to "string", "description" to "Filter by route pattern"),
                "has_auth" to mapOf("type" to "boolean", "description" to "Filter by auth presence"),
                "file_path" to mapOf("type" to "string", "description" to "Filter by file path"),
                "limit" to mapOf("type" to "number", "description" to "Max results (default: 30)"),
            ),
        ),
    )

    fun handle(args: Map<String, Any?>, conn: Connection): String {
        val detector = EntryPointDetector(conn)
        val filters = EntryPointFilters(
            entryType = (args["entry_type"] as? String)?.let { try { EntryType.valueOf(it) } catch (_: Exception) { null } },
            framework = args["framework"] as? String,
            httpMethod = args["http_method"] as? String,
            routePattern = args["route_pattern"] as? String,
            hasAuth = args["has_auth"] as? Boolean,
            filePath = args["file_path"] as? String,
            limit = (args["limit"] as? Number)?.toInt() ?: 30,
        )
        val result = detector.query(filters)
        if (result.results.isEmpty()) return "No entry points found. Run indexing first."
        return buildString {
            appendLine("Entry Points — ${result.total} found")
            appendLine("By Type: ${result.summary.byType.entries.joinToString(" ") { "${it.key}=${it.value}" }}")
            appendLine("By Framework: ${result.summary.byFramework.entries.joinToString(" ") { "${it.key}=${it.value}" }.ifEmpty { "N/A" }}")
            appendLine("Auth: ${result.summary.authCoverage.withAuth} with, ${result.summary.authCoverage.withoutAuth} without")
            appendLine()
            for (ep in result.results) {
                if (ep.entryType == EntryType.HTTP_HANDLER) {
                    val auth = if (ep.hasAuth) " \uD83D\uDD12" else ""
                    appendLine("  ${ep.httpMethod} ${ep.fullRoute}$auth → ${ep.symbolName}")
                    appendLine("    ${ep.filePath}:${ep.startLine} [${ep.framework}]")
                } else {
                    appendLine("  [${ep.entryType}] ${ep.symbolName}${ep.eventName?.let { " ($it)" } ?: ""}")
                    appendLine("    ${ep.filePath}:${ep.startLine}")
                }
            }
        }
    }
}
