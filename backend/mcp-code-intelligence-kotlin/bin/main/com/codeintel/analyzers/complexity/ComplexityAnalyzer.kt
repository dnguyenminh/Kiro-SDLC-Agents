/**
 * KSA-161: Complexity Analyzer — Main orchestrator.
 */
package com.codeintel.analyzers.complexity

import com.codeintel.parsers.SyntaxNode
import java.sql.Connection

class ComplexityAnalyzer(private val conn: Connection) {
    private val calculator = ComplexityCalculator()
    private val grader = GradeAssigner()
    private val store = ComplexityStore(conn)

    fun analyzeFunction(
        symbolId: Int, symbolName: String, filePath: String,
        startLine: Int, endLine: Int,
        bodyNode: SyntaxNode, language: String,
    ): ComplexityResult? {
        val breakdown = calculator.calculate(bodyNode, language) ?: return null
        val grade = grader.assignGrade(breakdown.cyclomaticComplexity)
        val result = ComplexityResult(
            symbolId = symbolId, symbolName = symbolName,
            filePath = filePath, startLine = startLine, endLine = endLine,
            grade = grade,
            cyclomaticComplexity = breakdown.cyclomaticComplexity,
            branches = breakdown.branches, loops = breakdown.loops,
            logicalOps = breakdown.logicalOps,
            exceptionHandlers = breakdown.exceptionHandlers,
            nestingDepth = breakdown.nestingDepth,
            earlyReturns = breakdown.earlyReturns,
        )
        store.upsert(result)
        return result
    }

    fun analyzeFileFromDB(
        filePath: String,
        parseAndGetBody: (Int, Int, Int) -> SyntaxNode?,
    ): FileComplexityResult {
        val sql = """
            SELECT s.id, s.name, s.start_line, s.end_line, f.language, f.relative_path
            FROM symbols s JOIN files f ON f.id = s.file_id
            WHERE f.relative_path LIKE ? AND s.kind IN ('function','method')
        """.trimIndent()
        val symbols = conn.prepareStatement(sql).use { stmt ->
            stmt.setString(1, "%$filePath%")
            val rs = stmt.executeQuery()
            val list = mutableListOf<SymbolRow>()
            while (rs.next()) list.add(SymbolRow(
                rs.getInt("id"), rs.getString("name"),
                rs.getInt("start_line"), rs.getInt("end_line"),
                rs.getString("language"), rs.getString("relative_path"),
            ))
            list
        }
        val results = symbols.mapNotNull { sym ->
            val body = parseAndGetBody(sym.id, sym.startLine, sym.endLine) ?: return@mapNotNull null
            analyzeFunction(sym.id, sym.name, sym.relativePath, sym.startLine, sym.endLine, body, sym.language)
        }
        val totalCC = results.sumOf { it.cyclomaticComplexity }
        return FileComplexityResult(
            filePath = filePath, functions = results,
            averageComplexity = if (results.isNotEmpty()) totalCC.toDouble() / results.size else 0.0,
            maxComplexity = results.maxOfOrNull { it.cyclomaticComplexity } ?: 0,
            totalFunctions = results.size,
        )
    }

    fun query(filters: ComplexityFilters): ComplexityQueryResult = store.query(filters)

    fun supportsLanguage(language: String): Boolean = calculator.supportsLanguage(language)

    private data class SymbolRow(
        val id: Int, val name: String, val startLine: Int,
        val endLine: Int, val language: String, val relativePath: String,
    )
}
