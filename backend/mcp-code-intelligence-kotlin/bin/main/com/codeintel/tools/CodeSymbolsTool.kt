/** code_symbols tool — find symbols by name or list symbols in a file. */
package com.codeintel.tools

import com.codeintel.query.QueryLayer
import com.codeintel.query.SymbolResult
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive

class CodeSymbolsTool(private val queryLayer: QueryLayer) {

    /** Execute code_symbols with given arguments. */
    fun execute(args: JsonObject): String {
        val name = args["name"]?.jsonPrimitive?.content
        val file = args["file"]?.jsonPrimitive?.content
        val kind = args["kind"]?.jsonPrimitive?.content
        val limit = args["limit"]?.jsonPrimitive?.int ?: 50

        if (file != null) return formatFileSymbols(file, queryLayer.getFileSymbols(file))
        if (name != null) return formatSymbolList(name, queryLayer.findSymbols(name, kind, limit))
        return "Provide either \"name\" or \"file\" parameter"
    }

    private fun formatFileSymbols(file: String, symbols: List<SymbolResult>): String {
        if (symbols.isEmpty()) return "No symbols found in $file"
        val lines = mutableListOf("Symbols in $file (${symbols.size}):\n")
        for (s in symbols) {
            val vis = if (s.visibility != null) "[${s.visibility}] " else ""
            lines.add("  L${s.startLine} $vis${s.kind} ${s.name}")
        }
        return lines.joinToString("\n")
    }

    private fun formatSymbolList(query: String, symbols: List<SymbolResult>): String {
        if (symbols.isEmpty()) return "No symbols matching \"$query\""
        val lines = mutableListOf("Found ${symbols.size} symbols matching \"$query\":\n")
        for (s in symbols) {
            lines.add("[${s.kind}] ${s.name} — ${s.filePath}:${s.startLine}")
            s.signature?.let { lines.add("  ${it.take(120)}") }
        }
        return lines.joinToString("\n")
    }
}
