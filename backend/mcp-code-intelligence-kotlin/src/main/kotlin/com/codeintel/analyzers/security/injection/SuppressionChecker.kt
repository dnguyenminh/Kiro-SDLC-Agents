/**
 * KSA-165: Suppression Checker — Detects nosec/NOLINT markers.
 */
package com.codeintel.analyzers.security.injection

import com.codeintel.analyzers.security.SuppressionInfo

private val DEFAULT_MARKERS = listOf(
    "// nosec" to "line", "# nosec" to "line", "// NOLINT" to "line",
    "/* NOLINT */" to "line", "// @security-ignore" to "line",
    "# @security-ignore" to "line", "// nosec:block" to "block",
    "// @security-ignore-file" to "file"
)

class SuppressionChecker(private val markers: List<Pair<String, String>> = DEFAULT_MARKERS) {

    fun isSuppressed(sourceLines: List<String>, line: Int): SuppressionInfo? {
        val lineIdx = line - 1
        if (lineIdx < 0 || lineIdx >= sourceLines.size) return null

        val lineText = sourceLines[lineIdx]
        val prevLineText = if (lineIdx > 0) sourceLines[lineIdx - 1] else ""

        for ((pattern, scope) in markers) {
            if (pattern in lineText) return SuppressionInfo(pattern, scope, line)
            if (pattern in prevLineText) return SuppressionInfo(pattern, scope, line - 1)
        }
        return null
    }

    fun isFileSuppressed(sourceLines: List<String>): Boolean {
        val headerLines = sourceLines.take(5)
        for (line in headerLines) {
            for ((pattern, scope) in markers) {
                if (scope == "file" && pattern in line) return true
            }
        }
        return false
    }
}
