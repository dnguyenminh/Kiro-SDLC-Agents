/**
 * git_search tool — searches git commit history using git log + grep.
 * Filters by query keywords, author, date, and file path.
 */
package com.codeintel.analyzers.similarity

import kotlinx.serialization.json.*
import java.io.File
import java.util.concurrent.TimeUnit

/** Executes git log search with keyword matching and optional filters. */
class GitSearchTool(private val workspace: String) {

    /** Execute git_search with given parameters. */
    fun execute(params: JsonObject): String {
        val query = params["query"]?.jsonPrimitive?.content ?: ""
        if (query.isBlank()) return """{"error":"'query' parameter is required"}"""

        val limit = params["limit"]?.jsonPrimitive?.int ?: 10
        val author = params["author"]?.jsonPrimitive?.content
        val since = params["since"]?.jsonPrimitive?.content
        val fileFilter = params["file_filter"]?.jsonPrimitive?.content

        val cmd = buildGitCommand(query, limit * 3, author, since, fileFilter)
        val output = runGitCommand(cmd) ?: return """{"error":"Failed to execute git log"}"""
        val commits = parseGitLog(output)
        val ranked = rankByRelevance(commits, query).take(limit)
        return formatResults(ranked, query)
    }

    private fun buildGitCommand(
        query: String, maxCount: Int, author: String?, since: String?, fileFilter: String?
    ): List<String> {
        val cmd = mutableListOf("git", "log", "--format=%H|%an|%ai|%s", "--max-count=$maxCount")
        val keywords = query.split("\\s+".toRegex())
        keywords.forEach { cmd.add("--grep=$it") }
        cmd.add("--all-match")
        author?.let { cmd.add("--author=$it") }
        since?.let { cmd.add("--since=$it") }
        fileFilter?.let { cmd.add("--"); cmd.add(it) }
        return cmd
    }

    private fun runGitCommand(cmd: List<String>): String? {
        return try {
            val process = ProcessBuilder(cmd)
                .directory(File(workspace))
                .redirectErrorStream(true)
                .start()
            val output = process.inputStream.bufferedReader().readText()
            process.waitFor(30, TimeUnit.SECONDS)
            if (process.exitValue() == 0) output else null
        } catch (_: Exception) { null }
    }

    private fun parseGitLog(output: String): List<GitCommit> {
        return output.lines()
            .filter { it.contains("|") }
            .mapNotNull { line ->
                val parts = line.split("|", limit = 4)
                if (parts.size < 4) return@mapNotNull null
                GitCommit(hash = parts[0], author = parts[1], date = parts[2], message = parts[3])
            }
    }

    private fun rankByRelevance(commits: List<GitCommit>, query: String): List<RankedCommit> {
        val keywords = query.lowercase().split("\\s+".toRegex())
        return commits.map { commit ->
            val msg = commit.message.lowercase()
            val score = keywords.count { msg.contains(it) }.toDouble() / keywords.size
            RankedCommit(commit, score.coerceIn(0.1, 1.0))
        }.sortedByDescending { it.relevance }
    }

    private fun formatResults(results: List<RankedCommit>, query: String): String {
        if (results.isEmpty()) return "No commits found matching \"$query\""
        return buildString {
            appendLine("Git History Search: \"$query\"")
            appendLine("Found ${results.size} relevant commits:")
            appendLine()
            for (r in results) {
                appendLine("[${String.format("%.2f", r.relevance)}] ${r.commit.hash.take(8)} -- ${r.commit.message}")
                appendLine("  Author: ${r.commit.author} | Date: ${r.commit.date.take(10)}")
                appendLine()
            }
        }
    }
}

/** Parsed git commit. */
private data class GitCommit(val hash: String, val author: String, val date: String, val message: String)

/** Commit with relevance score. */
private data class RankedCommit(val commit: GitCommit, val relevance: Double)
