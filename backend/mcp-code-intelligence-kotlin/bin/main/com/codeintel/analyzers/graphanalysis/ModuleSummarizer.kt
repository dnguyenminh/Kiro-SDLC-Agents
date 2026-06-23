/**
 * KSA-163: Module Summarizer — Aggregates quality metrics per module.
 */
package com.codeintel.analyzers.graphanalysis

import com.codeintel.analyzers.graphanalysis.utils.GraphLoader
import java.sql.Connection

class ModuleSummarizer(private val conn: Connection) {
    private val graphLoader = GraphLoader(conn)

    fun summarize(moduleName: String? = null): List<ModuleSummary> {
        val modules = getModules(moduleName)
        return modules.map { mod ->
            val circularDeps = CircularDepDetector(graphLoader).detect(CircularDepOptions(module = mod.name))
            val hotPaths = HotPathAnalyzer(graphLoader).analyze(module = mod.name, limit = 5)
            val deadImports = DeadImportDetector(conn).detect(module = mod.name)
            val avgComplexity = getAvgComplexity(mod.name)
            ModuleSummary(
                module = mod.name, fileCount = mod.fileCount,
                symbolCount = mod.symbolCount, circularDeps = circularDeps.size,
                hotPaths = hotPaths, deadImports = deadImports.size,
                avgComplexity = avgComplexity,
            )
        }
    }

    private fun getModules(name: String?): List<ModuleRow> {
        val sql = buildString {
            append("SELECT name, file_count, symbol_count FROM modules")
            if (name != null) append(" WHERE name = ?")
        }
        val list = mutableListOf<ModuleRow>()
        conn.prepareStatement(sql).use { stmt ->
            name?.let { stmt.setString(1, it) }
            val rs = stmt.executeQuery()
            while (rs.next()) list.add(ModuleRow(rs.getString("name"), rs.getInt("file_count"), rs.getInt("symbol_count")))
        }
        return list
    }

    private fun getAvgComplexity(module: String): Double? {
        val sql = """
            SELECT AVG(c.cyclomatic_complexity) as avg
            FROM complexity c JOIN symbols s ON s.id = c.symbol_id
            JOIN files f ON f.id = s.file_id WHERE f.module = ?
        """.trimIndent()
        conn.prepareStatement(sql).use { stmt ->
            stmt.setString(1, module)
            val rs = stmt.executeQuery()
            return if (rs.next()) rs.getDouble("avg").takeIf { !rs.wasNull() } else null
        }
    }

    private data class ModuleRow(val name: String, val fileCount: Int, val symbolCount: Int)
}
