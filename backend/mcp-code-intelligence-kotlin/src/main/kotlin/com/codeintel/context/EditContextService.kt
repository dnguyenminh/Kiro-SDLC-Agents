/** Edit Context Service — source + callers + tests + git for editing. KSA-171. */
package com.codeintel.context

import com.codeintel.context.models.*
import com.codeintel.graph.CallGraphService
import com.codeintel.graph.SymbolResolver
import com.codeintel.graph.TestDetector
import java.io.File
import java.sql.Connection

class EditContextService(
    private val conn: Connection,
    private val resolver: SymbolResolver,
    private val callGraph: CallGraphService,
    private val testDetector: TestDetector,
    private val workspace: String,
) {
    private val gitService = GitService(workspace)
    private val budgetMgr = TokenBudgetManager(4000)

    /** Get full edit context for a symbol. */
    fun getContext(params: EditContextParams): EditContextResult {
        val startTime = System.currentTimeMillis()

        val symbol = resolveSymbolInput(params.symbol)
            ?: return notFound(params.symbol, params.tokenBudget, startTime)

        val source = readSymbolSource(symbol)
        val signature = getSignature(symbol)

        val callers = if (params.includeCallers) getCallerContext(symbol, params.callerDepth) else null
        val tests = if (params.includeTests) getTestContext(symbol) else null
        val gitHistory = if (params.includeGit) getGitContext(symbol) else null
        val siblings = getSiblingContext(symbol)

        // Assemble within budget
        val sections = mutableMapOf<String, Pair<String, Int>>()
        sections["source"] = source to 1
        callers?.let { sections["callers"] = serializeCallers(it) to 2 }
        tests?.let { sections["tests"] = serializeTests(it) to 3 }
        gitHistory?.let { sections["git_history"] = serializeGit(it) to 5 }
        siblings?.let { sections["siblings"] = serializeSiblings(it) to 6 }

        val assembled = budgetMgr.assemble(sections, params.tokenBudget)
        val elapsed = System.currentTimeMillis() - startTime

        return EditContextResult(
            symbol = symbol.name,
            file = symbol.filePath,
            line = symbol.line,
            kind = symbol.kind,
            source = assembled.result["source"] ?: source,
            signature = signature,
            callers = if ("callers" in assembled.result) callers else null,
            tests = if ("tests" in assembled.result) tests else null,
            gitHistory = if ("git_history" in assembled.result) gitHistory else null,
            siblings = if ("siblings" in assembled.result) siblings else null,
            metadata = EditMetadata(
                tokenCount = assembled.tokenCount,
                tokenBudget = params.tokenBudget,
                sectionsIncluded = assembled.included,
                sectionsExcluded = assembled.excluded,
                queryTimeMs = elapsed,
            ),
        )
    }

    private fun resolveSymbolInput(input: String): ResolvedSymbolFull? {
        // Try file:line format
        if (":" in input && input.matches(Regex(".*:\\d+$"))) {
            val colonIdx = input.lastIndexOf(':')
            val filePart = input.substring(0, colonIdx)
            val line = input.substring(colonIdx + 1).toInt()
            return findSymbolAtLine(filePart, line)
        }

        val resolved = resolver.resolve(input)
        if (resolved.isEmpty()) return null

        val sym = resolved[0]
        val stmt = conn.prepareStatement("SELECT end_line, signature FROM symbols WHERE id = ?")
        stmt.setInt(1, sym.id)
        val rs = stmt.executeQuery()
        val endLine = if (rs.next()) rs.getInt(1).takeIf { !rs.wasNull() } else null
        val sig = rs.getString(2)

        return ResolvedSymbolFull(sym.id, sym.name, sym.kind, sym.filePath, sym.line, sym.parentSymbolId, endLine, sig)
    }

    private fun findSymbolAtLine(filePart: String, line: Int): ResolvedSymbolFull? {
        val stmt = conn.prepareStatement("""
            SELECT s.id, s.name, s.kind, f.relative_path, s.start_line, s.end_line, s.signature, s.parent_symbol
            FROM symbols s JOIN files f ON s.file_id = f.id
            WHERE f.relative_path LIKE ? AND s.start_line <= ? AND s.end_line >= ?
            ORDER BY (s.end_line - s.start_line) ASC LIMIT 1
        """.trimIndent())
        stmt.setString(1, "%$filePart")
        stmt.setInt(2, line)
        stmt.setInt(3, line)
        val rs = stmt.executeQuery()
        if (!rs.next()) return null
        val parentStr = rs.getString(8)
        return ResolvedSymbolFull(
            rs.getInt(1), rs.getString(2), rs.getString(3), rs.getString(4),
            rs.getInt(5), parentStr?.toIntOrNull(), rs.getInt(6).takeIf { !rs.wasNull() }, rs.getString(7),
        )
    }

    private fun readSymbolSource(symbol: ResolvedSymbolFull): String {
        return try {
            val lines = File(workspace, symbol.filePath).readLines()
            val start = symbol.line - 1
            val end = symbol.endLine ?: (start + 50)
            lines.subList(start.coerceAtLeast(0), end.coerceAtMost(lines.size)).joinToString("\n")
        } catch (_: Exception) { "" }
    }

    private fun getSignature(symbol: ResolvedSymbolFull): String? {
        if (symbol.signature != null) return symbol.signature
        val stmt = conn.prepareStatement("SELECT signature FROM symbols WHERE id = ?")
        stmt.setInt(1, symbol.id)
        val rs = stmt.executeQuery()
        return if (rs.next()) rs.getString(1) else null
    }

    private fun getCallerContext(symbol: ResolvedSymbolFull, depth: Int): List<CallerContext>? {
        val result = callGraph.findCallers(symbol.name, depth, 10)
        if (result.results.isEmpty()) return null
        return result.results.map { caller ->
            val ctx = getLineContext(caller.filePath, caller.callSiteLine, 2)
            CallerContext(
                symbol = caller.qualifiedName.ifEmpty { caller.symbol },
                file = caller.filePath, line = caller.callSiteLine, context = ctx,
            )
        }
    }

    private fun getLineContext(filePath: String, line: Int, surrounding: Int): String {
        return try {
            val lines = File(workspace, filePath).readLines()
            val start = maxOf(0, line - 1 - surrounding)
            val end = minOf(lines.size, line + surrounding)
            lines.subList(start, end).joinToString("\n")
        } catch (_: Exception) { "" }
    }

    private fun getTestContext(symbol: ResolvedSymbolFull): List<TestContext>? {
        val resolvedSym = com.codeintel.graph.models.ResolvedSymbol(
            id = symbol.id, name = symbol.name, kind = symbol.kind,
            filePath = symbol.filePath, line = symbol.line, parentSymbolId = symbol.parentSymbolId,
        )
        val testFiles = testDetector.findRelatedTests(listOf(resolvedSym), emptyList())
        if (testFiles.isEmpty()) return null
        val results = mutableListOf<TestContext>()
        for (tf in testFiles.take(3)) {
            try {
                val content = File(workspace, tf.file).readText()
                val blocks = extractTestBlocks(content, symbol.name)
                for (block in blocks.take(2)) {
                    results.add(TestContext(file = tf.file, testName = block.first, source = block.second))
                }
            } catch (_: Exception) { continue }
        }
        return results.ifEmpty { null }
    }

    private fun extractTestBlocks(content: String, symbolName: String): List<Pair<String, String>> {
        val blocks = mutableListOf<Pair<String, String>>()
        val lines = content.lines()
        val pattern = Regex("""(?:it|test|describe|@Test)\s*[\('"](.*?)['"]""")

        for ((i, line) in lines.withIndex()) {
            val match = pattern.find(line) ?: continue
            val window = lines.subList(i, minOf(i + 10, lines.size)).joinToString("\n")
            if (symbolName in line || symbolName in window) {
                val name = match.groupValues[1]
                val end = minOf(i + 15, lines.size)
                val source = lines.subList(i, end).joinToString("\n")
                blocks.add(name to source)
            }
        }
        return blocks
    }

    private fun getGitContext(symbol: ResolvedSymbolFull): List<GitCommit>? {
        val commits = gitService.getFileHistory(symbol.filePath, 5)
        return commits.ifEmpty { null }
    }

    private fun getSiblingContext(symbol: ResolvedSymbolFull): List<SiblingContext>? {
        val (sql, params) = if (symbol.parentSymbolId != null) {
            "SELECT name, kind, signature, start_line FROM symbols WHERE parent_symbol = ? AND id != ? ORDER BY start_line" to
                listOf(symbol.parentSymbolId.toString(), symbol.id)
        } else {
            """SELECT s.name, s.kind, s.signature, s.start_line
               FROM symbols s JOIN files f ON s.file_id = f.id
               WHERE f.relative_path = ? AND s.parent_symbol IS NULL AND s.id != ?
               ORDER BY s.start_line""" to listOf(symbol.filePath, symbol.id)
        }
        val stmt = conn.prepareStatement(sql)
        stmt.setString(1, params[0].toString())
        stmt.setInt(2, params[1] as Int)
        val rs = stmt.executeQuery()
        val siblings = mutableListOf<SiblingContext>()
        while (rs.next()) siblings.add(SiblingContext(rs.getString(1), rs.getString(2), rs.getString(3), rs.getInt(4)))
        return siblings.ifEmpty { null }
    }

    private fun serializeCallers(callers: List<CallerContext>) = callers.joinToString("\n") { "${it.symbol}|${it.file}:${it.line}" }
    private fun serializeTests(tests: List<TestContext>) = tests.joinToString("\n") { "${it.testName}|${it.file}" }
    private fun serializeGit(commits: List<GitCommit>) = commits.joinToString("\n") { "${it.hash} ${it.message}" }
    private fun serializeSiblings(siblings: List<SiblingContext>) = siblings.joinToString("\n") { "${it.name}|${it.kind}|${it.line}" }

    private fun notFound(symbol: String, budget: Int, startTime: Long): EditContextResult {
        return EditContextResult(
            symbol = symbol, file = "", line = 0, kind = "unknown", source = "",
            metadata = EditMetadata(tokenBudget = budget, sectionsExcluded = listOf("error: symbol not found"),
                queryTimeMs = System.currentTimeMillis() - startTime),
        )
    }
}

internal data class ResolvedSymbolFull(
    val id: Int, val name: String, val kind: String, val filePath: String,
    val line: Int, val parentSymbolId: Int?, val endLine: Int?, val signature: String?,
)
