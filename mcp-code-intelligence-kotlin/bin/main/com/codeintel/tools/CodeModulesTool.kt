/** code_modules tool — list discovered code modules. */
package com.codeintel.tools

import com.codeintel.query.ModuleResult
import com.codeintel.query.QueryLayer
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive

class CodeModulesTool(private val queryLayer: QueryLayer) {

    /** Execute code_modules with given arguments. */
    fun execute(args: JsonObject): String {
        val name = args["name"]?.jsonPrimitive?.content
        var modules = queryLayer.listModules()
        if (name != null) {
            modules = modules.filter { it.name.lowercase().startsWith(name.lowercase()) }
        }
        return formatModules(modules)
    }

    private fun formatModules(modules: List<ModuleResult>): String {
        if (modules.isEmpty()) return "No modules indexed yet. Run indexing first."
        val lines = mutableListOf("Modules (${modules.size}):\n")
        for (m in modules) {
            lines.add("\uD83D\uDCE6 ${m.name}")
            lines.add("   Path: ${m.rootPath}")
            m.language?.let { lines.add("   Lang: $it") }
            lines.add("   Files: ${m.fileCount} | Symbols: ${m.symbolCount}")
            val patterns = formatPatterns(m)
            if (patterns.isNotEmpty()) lines.add("   Patterns: $patterns")
            m.purpose?.let { lines.add("   Purpose: $it") }
            m.description?.let { lines.add("   $it") }
            lines.add("")
        }
        return lines.joinToString("\n")
    }

    private fun formatPatterns(m: ModuleResult): String {
        val parts = mutableListOf<String>()
        m.diStyle?.let { parts.add("DI=$it") }
        m.errorHandling?.let { parts.add("Errors=$it") }
        m.namingConvention?.let { parts.add("Naming=$it") }
        m.loggingFramework?.let { parts.add("Logging=$it") }
        m.testingFramework?.let { parts.add("Testing=$it") }
        return parts.joinToString(" | ")
    }
}
