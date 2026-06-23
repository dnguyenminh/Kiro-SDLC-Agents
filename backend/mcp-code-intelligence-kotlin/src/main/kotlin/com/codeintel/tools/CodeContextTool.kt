/** code_context tool — get source code around a symbol or line range. */
package com.codeintel.tools

import com.codeintel.query.QueryLayer
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive
import java.nio.file.Path
import kotlin.io.path.exists
import kotlin.io.path.readText

class CodeContextTool(private val queryLayer: QueryLayer, private val workspace: String) {

    /** Execute code_context with given arguments. */
    fun execute(args: JsonObject): String {
        val file = args["file"]?.jsonPrimitive?.content ?: ""
        val symbol = args["symbol"]?.jsonPrimitive?.content
        val startLine = args["startLine"]?.jsonPrimitive?.int
        val endLine = args["endLine"]?.jsonPrimitive?.int
        val ctxLines = args["contextLines"]?.jsonPrimitive?.int ?: 5

        val fullPath = Path.of(workspace, file)
        if (!fullPath.exists()) return "File not found: $file"

        val lines = fullPath.readText(Charsets.UTF_8).split("\n")
        if (symbol != null) return getSymbolContext(file, symbol, lines, ctxLines)

        val start = maxOf(0, (startLine ?: 1) - 1 - ctxLines)
        val end = minOf(lines.size, (endLine ?: startLine ?: lines.size) + ctxLines)
        return formatLines(lines, start, end, file)
    }

    private fun getSymbolContext(file: String, symbol: String, lines: List<String>, ctx: Int): String {
        val symbols = queryLayer.getFileSymbols(file)
        val match = symbols.find { it.name == symbol } ?: return "Symbol \"$symbol\" not found in $file"
        val start = maxOf(0, match.startLine - 1 - ctx)
        val end = minOf(lines.size, match.endLine + ctx)
        return formatLines(lines, start, end, file)
    }

    private fun formatLines(lines: List<String>, start: Int, end: Int, file: String): String {
        val numbered = (start until end).joinToString("\n") { i ->
            "${(i + 1).toString().padStart(4)} | ${lines[i]}"
        }
        return "// $file [${start + 1}-$end]\n$numbered"
    }
}
