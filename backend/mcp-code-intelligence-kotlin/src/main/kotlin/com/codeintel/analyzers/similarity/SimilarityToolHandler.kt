/** MCP tool handler for similarity analysis (duplicates, dead code, git search). */
package com.codeintel.analyzers.similarity

import com.codeintel.analyzers.similarity.models.DeadCodeReport
import com.codeintel.analyzers.similarity.models.DuplicateReport
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive
import java.sql.Connection

/** Dispatch similarity tool calls. */
class SimilarityToolHandler(
    private val conn: Connection,
    private val workspace: String
) {
    private val gitSearchTool by lazy { GitSearchTool(workspace) }

    /** Dispatch by tool name. Returns null if not a similarity tool. */
    fun dispatch(name: String, args: JsonObject): String? {
        return when (name) {
            "find_duplicates" -> handleFindDuplicates(args)
            "find_dead_code" -> handleFindDeadCode(args)
            "git_search" -> gitSearchTool.execute(args)
            else -> null
        }
    }

    /** Handle find_duplicates tool invocation. */
    fun handleFindDuplicates(params: JsonObject): String {
        val filePath = params["file"]?.jsonPrimitive?.content
        val minSim = params["min_similarity"]?.jsonPrimitive?.double ?: 0.85
        val minLines = params["min_lines"]?.jsonPrimitive?.int ?: 5

        val detector = DuplicateDetector(conn, minSim, minLines)
        val report = detector.detect(filePath)
        return formatDuplicateReport(report)
    }

    /** Handle find_dead_code tool invocation. */
    fun handleFindDeadCode(params: JsonObject): String {
        val filePath = params["file"]?.jsonPrimitive?.content
        val minConf = params["min_confidence"]?.jsonPrimitive?.int ?: 60

        val detector = DeadCodeDetector(conn, workspace, minConfidence = minConf)
        val report = detector.detect(filePath)
        return formatDeadCodeReport(report)
    }

    private fun formatDuplicateReport(report: DuplicateReport): String {
        return buildString {
            appendLine("Duplicate Detection Report")
            appendLine("=".repeat(40))
            appendLine("Functions scanned: ${report.totalFunctionsScanned}")
            appendLine("Similar pairs found: ${report.pairs.size}")
            appendLine("Clusters: ${report.clusters.size}")
            appendLine()
            if (report.clusters.isEmpty()) {
                appendLine("No duplicates found above threshold.")
                return@buildString
            }
            appendLine("Duplicate Clusters:")
            appendLine("-".repeat(30))
            for ((i, cluster) in report.clusters.withIndex()) {
                appendLine("\nCluster ${i + 1} (${cluster.members.size} members):")
                for (member in cluster.members) appendLine("  - $member")
            }
            if (report.suggestions.isNotEmpty()) {
                appendLine("\n\nRefactoring Suggestions:")
                appendLine("-".repeat(30))
                for (s in report.suggestions) {
                    appendLine("\n[${s.suggestionType}] ${s.description}")
                    appendLine("  Estimated lines saved: ~${s.estimatedLinesSaved}")
                    appendLine("  Members: ${s.members.take(5).joinToString(", ")}")
                }
            }
        }
    }

    private fun formatDeadCodeReport(report: DeadCodeReport): String {
        return buildString {
            appendLine("Dead Code Detection Report")
            appendLine("=".repeat(40))
            appendLine(report.summary)
            appendLine()
            if (report.candidates.isEmpty()) {
                appendLine("No dead code candidates found above confidence threshold.")
                return@buildString
            }
            appendLine("Candidates (${report.candidates.size}):")
            appendLine("-".repeat(30))
            for (c in report.candidates) {
                appendLine("\n[${c.confidence}%] ${c.name}  (${c.filePath}:${c.startLine}-${c.endLine})")
                appendLine("  Reasons: ${c.reasons.joinToString(", ")}")
            }
        }
    }
}
