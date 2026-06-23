/** AI Context Service — intent-aware context assembly with token budgeting. KSA-171. */
package com.codeintel.context

import com.codeintel.context.models.*
import com.codeintel.graph.CallGraphService
import com.codeintel.graph.SymbolResolver
import com.codeintel.graph.models.ResolvedSymbol
import java.io.File
import java.sql.Connection

class AIContextService(
    private val conn: Connection,
    private val resolver: SymbolResolver,
    private val callGraph: CallGraphService,
    private val workspace: String,
) {
    private val gitService = GitService(workspace)

    /** Get intent-aware context for a symbol within token budget. */
    fun getContext(params: AIContextParams): AIContextResponse {
        val startTime = System.currentTimeMillis()

        val resolved = resolver.resolve(params.symbol)
        if (resolved.isEmpty()) return notFound(params, startTime)

        val target = resolved[0]
        val strategy = getStrategy(params.intent)
        val budgetMgr = TokenBudgetManager(params.tokenBudget)
        val context = mutableMapOf<String, String>()
        val included = mutableListOf<String>()
        val omitted = mutableListOf<String>()

        for (section in strategy.sections) {
            if (budgetMgr.isExhausted()) { omitted.add(section.name); continue }

            val content = fetchSection(section, target, params.callerDepth) ?: continue
            val tokens = budgetMgr.countTokens(content)

            if (budgetMgr.canFit(tokens)) {
                context[section.name] = content
                budgetMgr.consume(tokens)
                included.add(section.name)
            } else if (budgetMgr.remaining() > 100) {
                context[section.name] = budgetMgr.truncateToFit(content)
                context["${section.name}_truncated"] = "true"
                budgetMgr.consumeAll()
                included.add(section.name)
            } else {
                omitted.add(section.name)
            }
        }

        return AIContextResponse(
            symbol = target.name,
            filePath = target.filePath,
            kind = target.kind,
            intent = params.intent,
            context = context,
            metadata = ContextMetadata(
                budgetUsed = budgetMgr.used(),
                budgetTotal = params.tokenBudget,
                sectionsIncluded = included,
                sectionsOmitted = omitted,
                queryTimeMs = System.currentTimeMillis() - startTime,
            ),
        )
    }

    private fun fetchSection(section: SectionDef, symbol: ResolvedSymbol, callerDepth: Int): String? {
        return try {
            when (section.name) {
                "source" -> fetchSource(symbol)
                "callers" -> fetchCallers(symbol, callerDepth, section.format)
                "callees" -> fetchCallees(symbol, callerDepth)
                "siblings" -> fetchSiblings(symbol)
                "imports" -> fetchImports(symbol)
                "tests" -> fetchRelatedTests(symbol)
                "type_definitions" -> fetchTypeDefinitions(symbol)
                "doc_comment" -> fetchDocComment(symbol)
                "error_patterns" -> fetchErrorPatterns(symbol)
                "recent_changes" -> fetchRecentChanges(symbol)
                "test_patterns" -> fetchTestPatterns(symbol)
                "mocks_needed" -> fetchMocksNeeded(symbol)
                else -> null
            }
        } catch (_: Exception) { null }
    }

    private fun fetchSource(symbol: ResolvedSymbol): String? {
        val fullPath = File(workspace, symbol.filePath)
        if (!fullPath.isFile) return null
        val lines = fullPath.readLines()
        val start = symbol.line - 1
        val end = getSymbolEndLine(symbol) ?: (start + 50)
        return lines.subList(start.coerceAtLeast(0), end.coerceAtMost(lines.size)).joinToString("\n")
    }

    private fun fetchCallers(symbol: ResolvedSymbol, depth: Int, format: String): String? {
        val result = callGraph.findCallers(symbol.name, depth, 10)
        if (result.results.isEmpty()) return null
        return if (format == "summary") {
            result.results.joinToString("\n") { "${it.symbol} (${it.filePath}:${it.callSiteLine})" }
        } else {
            result.results.joinToString("\n") { "${it.symbol}|${it.filePath}|${it.callSiteLine}|${it.kind}" }
        }
    }

    private fun fetchCallees(symbol: ResolvedSymbol, depth: Int): String? {
        val result = callGraph.findCallees(symbol.name, depth, 10)
        if (result.results.isEmpty()) return null
        return result.results.joinToString("\n") { "${it.symbol}|${it.filePath}|${it.callSiteLine}|${it.kind}" }
    }

    private fun fetchSiblings(symbol: ResolvedSymbol): String? {
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
        val lines = mutableListOf<String>()
        while (rs.next()) lines.add("${rs.getString(1)}|${rs.getString(2)}|${rs.getString(3) ?: ""}|${rs.getInt(4)}")
        return lines.ifEmpty { null }?.joinToString("\n")
    }

    private fun fetchImports(symbol: ResolvedSymbol): String? {
        val stmt = conn.prepareStatement(
            "SELECT DISTINCT target_symbol FROM relationships WHERE source_symbol_id = ? AND kind = 'imports'"
        )
        stmt.setInt(1, symbol.id)
        val rs = stmt.executeQuery()
        val imports = mutableListOf<String>()
        while (rs.next()) imports.add(rs.getString(1))
        return imports.ifEmpty { null }?.joinToString(", ")
    }

    private fun fetchRelatedTests(symbol: ResolvedSymbol): String? {
        val stmt = conn.prepareStatement("""
            SELECT DISTINCT f.relative_path
            FROM relationships r JOIN files f ON r.file_path = f.relative_path
            WHERE r.target_symbol LIKE ?
            AND (f.relative_path LIKE '%test%' OR f.relative_path LIKE '%spec%')
            LIMIT 5
        """.trimIndent())
        stmt.setString(1, "%${symbol.name}%")
        val rs = stmt.executeQuery()
        val files = mutableListOf<String>()
        while (rs.next()) files.add(rs.getString(1))
        return files.ifEmpty { null }?.joinToString("\n")
    }

    private fun fetchTypeDefinitions(symbol: ResolvedSymbol): String? {
        val stmt = conn.prepareStatement("""
            SELECT DISTINCT s.name, s.kind, s.signature, f.relative_path
            FROM relationships r
            JOIN symbols s ON s.id = r.target_symbol_id
            JOIN files f ON s.file_id = f.id
            WHERE r.source_symbol_id = ? AND s.kind IN ('interface','type_alias','enum','class')
            LIMIT 10
        """.trimIndent())
        stmt.setInt(1, symbol.id)
        val rs = stmt.executeQuery()
        val defs = mutableListOf<String>()
        while (rs.next()) defs.add("${rs.getString(1)}|${rs.getString(2)}|${rs.getString(3) ?: ""}|${rs.getString(4)}")
        return defs.ifEmpty { null }?.joinToString("\n")
    }

    private fun fetchDocComment(symbol: ResolvedSymbol): String? {
        val stmt = conn.prepareStatement("SELECT doc_comment FROM symbols WHERE id = ?")
        stmt.setInt(1, symbol.id)
        val rs = stmt.executeQuery()
        return if (rs.next()) rs.getString(1)?.takeIf { it.isNotBlank() } else null
    }

    private fun fetchErrorPatterns(symbol: ResolvedSymbol): String? {
        val source = fetchSource(symbol) ?: return null
        val patterns = source.lines().mapIndexedNotNull { i, line ->
            val trimmed = line.trim()
            when {
                trimmed.startsWith("throw ") -> "throw|${i + 1}|$trimmed"
                trimmed.startsWith("catch") -> "catch|${i + 1}|$trimmed"
                ".catch(" in trimmed -> "promise-catch|${i + 1}|$trimmed"
                else -> null
            }
        }
        return patterns.ifEmpty { null }?.joinToString("\n")
    }

    private fun fetchRecentChanges(symbol: ResolvedSymbol): String? {
        val commits = gitService.getFileHistory(symbol.filePath, 5)
        return commits.ifEmpty { null }?.joinToString("\n") { "${it.hash} ${it.message}" }
    }

    private fun fetchTestPatterns(symbol: ResolvedSymbol): String? {
        val stmt = conn.prepareStatement("""
            SELECT DISTINCT s.name FROM symbols s JOIN files f ON s.file_id = f.id
            WHERE (f.relative_path LIKE '%test%' OR f.relative_path LIKE '%spec%')
            AND s.kind = 'function'
            AND f.module = (SELECT module FROM files WHERE relative_path = ?)
            LIMIT 10
        """.trimIndent())
        stmt.setString(1, symbol.filePath)
        val rs = stmt.executeQuery()
        val names = mutableListOf<String>()
        while (rs.next()) names.add(rs.getString(1))
        return names.ifEmpty { null }?.joinToString(", ")
    }

    private fun fetchMocksNeeded(symbol: ResolvedSymbol): String? {
        val result = callGraph.findCallees(symbol.name, 1, 20)
        if (result.results.isEmpty()) return null
        val deps = result.results
            .filter { it.filePath != symbol.filePath && it.filePath != "(external)" }
            .map { "${it.symbol}|${it.filePath}" }
        return deps.ifEmpty { null }?.joinToString("\n")
    }

    private fun getSymbolEndLine(symbol: ResolvedSymbol): Int? {
        val stmt = conn.prepareStatement("SELECT end_line FROM symbols WHERE id = ?")
        stmt.setInt(1, symbol.id)
        val rs = stmt.executeQuery()
        return if (rs.next()) rs.getInt(1).takeIf { !rs.wasNull() } else null
    }

    private fun notFound(params: AIContextParams, startTime: Long): AIContextResponse {
        val suggestions = resolver.suggest(params.symbol)
        return AIContextResponse(
            symbol = params.symbol, filePath = "", kind = "unknown", intent = params.intent,
            context = mapOf("error" to "Symbol \"${params.symbol}\" not found", "suggestions" to suggestions.joinToString(",")),
            metadata = ContextMetadata(
                budgetTotal = params.tokenBudget,
                queryTimeMs = System.currentTimeMillis() - startTime,
            ),
        )
    }
}
