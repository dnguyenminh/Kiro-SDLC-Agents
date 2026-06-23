/** Test Detector — identifies test files and finds related tests. KSA-173. */
package com.codeintel.graph

import com.codeintel.graph.models.RelatedTest
import com.codeintel.graph.models.ResolvedSymbol
import java.sql.Connection

class TestDetector(private val conn: Connection) {

    /** Check if a file path is a test file. */
    fun isTestFile(filePath: String): Boolean {
        val basename = filePath.substringAfterLast("/")
        return TEST_PATH_PATTERNS.any { it.containsMatchIn(filePath) } ||
            TEST_FILE_PATTERNS.any { it.containsMatchIn(basename) }
    }

    /** Find test files related to the given symbols and impacts. */
    fun findRelatedTests(symbols: List<ResolvedSymbol>, impactFiles: List<String>): List<RelatedTest> {
        val results = mutableListOf<RelatedTest>()
        val seen = mutableSetOf<String>()

        for (sym in symbols) {
            val sourceBasename = sym.filePath.substringAfterLast("/").substringBeforeLast(".")
            val stmt = conn.prepareStatement(
                "SELECT DISTINCT file_path FROM relationships WHERE kind = 'imports' AND target_symbol LIKE ?"
            )
            stmt.setString(1, "%$sourceBasename%")
            val rs = stmt.executeQuery()
            while (rs.next()) {
                val tf = rs.getString(1)
                if (isTestFile(tf) && tf !in seen) {
                    seen.add(tf)
                    results.add(RelatedTest(file = tf, reason = "Tests ${sym.name}"))
                }
            }
        }

        for (file in impactFiles) {
            if (isTestFile(file) && file !in seen) {
                seen.add(file)
                results.add(RelatedTest(file = file, reason = "Calls modified symbol"))
            }
        }

        return results
    }

    companion object {
        private val TEST_PATH_PATTERNS = listOf(
            Regex("/tests?/", RegexOption.IGNORE_CASE),
            Regex("/__tests__/"),
            Regex("/spec/", RegexOption.IGNORE_CASE),
        )
        private val TEST_FILE_PATTERNS = listOf(
            Regex("\\.test\\.[tj]sx?$"),
            Regex("\\.spec\\.[tj]sx?$"),
            Regex("Test\\.kt$"),
            Regex("_test\\.py$"),
            Regex("^test_.*\\.py$"),
        )
    }
}
