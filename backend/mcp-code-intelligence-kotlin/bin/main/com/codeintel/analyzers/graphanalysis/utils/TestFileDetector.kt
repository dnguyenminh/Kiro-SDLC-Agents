/**
 * KSA-163: Test file detection heuristics.
 */
package com.codeintel.analyzers.graphanalysis.utils

class TestFileDetector {
    private val testPatterns = listOf(
        Regex("\\.test\\.[jt]sx?$"),
        Regex("\\.spec\\.[jt]sx?$"),
        Regex("_test\\.(py|go|rs)$"),
        Regex("test_.*\\.py$"),
        Regex("Test\\.java$"),
        Regex("Test\\.kt$"),
    )
    private val testDirs = listOf("__tests__", "tests", "test", "spec")

    fun isTestFile(filePath: String): Boolean {
        val normalized = filePath.replace("\\", "/")
        return testPatterns.any { it.containsMatchIn(normalized) } ||
            testDirs.any { "/$it/" in normalized }
    }

    fun isTestFunction(name: String): Boolean =
        name.startsWith("test_") || name.startsWith("Test") ||
            name.startsWith("it_") || name.startsWith("should_") ||
            Regex("^(describe|it|test)\\b").containsMatchIn(name)
}
