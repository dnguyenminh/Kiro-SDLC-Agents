/** Dead code detection using call graph reachability + confidence scoring. */
package com.codeintel.analyzers.similarity

import com.codeintel.analyzers.similarity.models.DeadCodeReport
import com.codeintel.analyzers.similarity.models.ScoredCandidate
import com.codeintel.log
import java.io.File
import java.sql.Connection

/** Detect unreachable code using call graph reachability + confidence scoring. */
class DeadCodeDetector(
    private val conn: Connection,
    private val workspace: String,
    private val entryPoints: List<String> = emptyList(),
    private val minConfidence: Int = 60
) {
    private val scorer = ConfidenceScorer()
    private val dispatchRecognizer = DynamicDispatchRecognizer()

    /** Find dead code with confidence scoring. */
    fun detect(filePath: String? = null): DeadCodeReport {
        val allFunctions = getAllFunctions(filePath)
        log("Scanning ${allFunctions.size} functions for dead code")

        if (allFunctions.isEmpty()) {
            return DeadCodeReport(0, 0, emptyList(), "No functions found to analyze.")
        }

        val entries = entryPoints.ifEmpty { detectEntryPoints() }
        val callGraph = SimpleCallGraph(conn)
        val analyzer = ReachabilityAnalyzer(callGraph, entries)
        val reachable = analyzer.computeReachable()

        val unreachableIds = allFunctions.map { it["id"] as String }.toSet() - reachable
        val candidates = scoreUnreachable(allFunctions, unreachableIds)

        val summary = buildSummary(allFunctions.size, reachable.size, candidates.size)
        return DeadCodeReport(allFunctions.size, reachable.size, candidates, summary)
    }

    private fun scoreUnreachable(
        allFunctions: List<Map<String, Any>>,
        unreachableIds: Set<String>
    ): List<ScoredCandidate> {
        return allFunctions
            .filter { (it["id"] as String) in unreachableIds }
            .mapNotNull { func -> scoreCandidate(func) }
            .sortedByDescending { it.confidence }
    }

    private fun scoreCandidate(func: Map<String, Any>): ScoredCandidate? {
        val context = buildScoringContext(func)
        val (confidence, reasons) = scorer.score(func["id"] as String, context)
        if (confidence < minConfidence) return null
        return ScoredCandidate(
            functionId = func["id"] as String,
            name = func["name"] as String,
            filePath = func["file_path"] as String,
            startLine = func["start_line"] as Int,
            endLine = func["end_line"] as Int,
            confidence = confidence,
            reasons = reasons,
        )
    }

    private fun buildSummary(total: Int, reachable: Int, candidates: Int): String {
        return "Scanned $total functions. $reachable reachable from entry points. " +
            "$candidates dead code candidates (confidence >= $minConfidence%)."
    }

    private fun getAllFunctions(filePath: String?): List<Map<String, Any>> {
        val sql = buildString {
            append("""
                SELECT s.name, s.kind, s.start_line, s.end_line, s.visibility,
                       f.relative_path, s.doc_comment
                FROM symbols s JOIN files f ON s.file_id = f.id
                WHERE s.kind IN ('function', 'method')
            """.trimIndent())
            if (filePath != null) append(" AND f.relative_path = ?")
        }
        return executeFunctionQuery(sql, filePath)
    }

    private fun executeFunctionQuery(sql: String, filePath: String?): List<Map<String, Any>> {
        val results = mutableListOf<Map<String, Any>>()
        conn.prepareStatement(sql).use { stmt ->
            if (filePath != null) stmt.setString(1, filePath)
            stmt.executeQuery().use { rs ->
                while (rs.next()) {
                    results.add(mapOf(
                        "id" to "${rs.getString("relative_path")}:${rs.getString("name")}",
                        "name" to rs.getString("name"),
                        "kind" to rs.getString("kind"),
                        "start_line" to rs.getInt("start_line"),
                        "end_line" to rs.getInt("end_line"),
                        "visibility" to (rs.getString("visibility") ?: ""),
                        "file_path" to rs.getString("relative_path"),
                        "doc_comment" to (rs.getString("doc_comment") ?: ""),
                    ))
                }
            }
        }
        return results
    }

    private fun detectEntryPoints(): List<String> {
        val patterns = listOf("main", "__main__", "app", "server", "handle_", "route_", "test_")
        val entries = mutableListOf<String>()
        conn.prepareStatement("""
            SELECT s.name, f.relative_path, s.visibility
            FROM symbols s JOIN files f ON s.file_id = f.id
            WHERE s.kind IN ('function', 'method')
        """.trimIndent()).use { stmt ->
            stmt.executeQuery().use { rs ->
                while (rs.next()) {
                    val name = rs.getString("name")
                    val path = rs.getString("relative_path")
                    val vis = rs.getString("visibility") ?: ""
                    val funcId = "$path:$name"
                    if (vis in listOf("public", "export") || patterns.any { name.startsWith(it) }) {
                        entries.add(funcId)
                    }
                }
            }
        }
        log("Detected ${entries.size} entry points")
        return entries
    }

    private fun buildScoringContext(func: Map<String, Any>): Map<String, Boolean> {
        val context = mutableMapOf<String, Boolean>()
        context["no_callers"] = true
        context["not_exported"] = func["visibility"] !in listOf("public", "export")
        val doc = func["doc_comment"] as String
        context["has_deprecated"] = dispatchRecognizer.hasDeprecatedMarker(doc)
        context["dynamic_dispatch"] = checkDynamicDispatch(func)
        context["no_tests"] = !hasTests(func["name"] as String)
        context["recently_modified"] = false
        context["config_reference"] = false
        return context
    }

    private fun checkDynamicDispatch(func: Map<String, Any>): Boolean {
        val file = File(workspace, func["file_path"] as String)
        if (!file.exists()) return false
        return try {
            val lines = file.readLines()
            val start = maxOf(0, (func["start_line"] as Int) - 1)
            val end = minOf(lines.size, func["end_line"] as Int)
            val body = lines.subList(start, end).joinToString("\n")
            dispatchRecognizer.isDynamicallyDispatched(body)
        } catch (_: Exception) { false }
    }

    private fun hasTests(functionName: String): Boolean {
        conn.prepareStatement("""
            SELECT COUNT(*) FROM symbols
            WHERE name LIKE ? AND kind IN ('function', 'method')
        """.trimIndent()).use { stmt ->
            stmt.setString(1, "%test_$functionName%")
            stmt.executeQuery().use { rs ->
                return rs.next() && rs.getInt(1) > 0
            }
        }
    }
}
