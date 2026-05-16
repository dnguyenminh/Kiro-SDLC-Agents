/** code_kb_export tool — export code intelligence data as KB payloads. */
package com.codeintel.tools

import com.codeintel.query.ModuleResult
import com.codeintel.query.QueryLayer
import kotlinx.serialization.json.*

class CodeKbExportTool(
    private val queryLayer: QueryLayer,
    private val workspace: String
) {

    /** Execute code_kb_export with given arguments. */
    fun execute(args: JsonObject): String {
        val module = args["module"]?.jsonPrimitive?.content
        val format = args["format"]?.jsonPrimitive?.content ?: "json"
        val modules = queryLayer.listModulesWithPatterns(module)
        val projectName = extractProjectName(workspace)
        return if (format == "text") formatAsText(modules, projectName)
        else formatAsJson(modules, projectName)
    }

    private fun extractProjectName(path: String): String {
        val parts = path.replace("\\", "/").trimEnd('/').split("/")
        return parts.lastOrNull() ?: "unknown"
    }

    private fun buildPayload(m: ModuleResult, project: String): KbPayload {
        val content = listOf(
            "Module: ${m.name}",
            "Language: ${m.language ?: "unknown"}",
            "Purpose: ${m.purpose ?: "unknown"}",
            "Files: ${m.fileCount}",
            "Symbols: ${m.symbolCount}",
            "",
            "Patterns:",
            "  DI Style: ${m.diStyle ?: "unknown"}",
            "  Error Handling: ${m.errorHandling ?: "unknown"}",
            "  Naming: ${m.namingConvention ?: "unknown"}",
            "  Logging: ${m.loggingFramework ?: "unknown"}",
            "  Testing: ${m.testingFramework ?: "unknown"}"
        ).joinToString("\n")
        val lang = m.language ?: "unknown"
        return KbPayload(
            title = "Code Index — ${m.name}",
            content = content,
            tags = "code-index, ${m.name}, $lang",
            project = project
        )
    }

    private fun formatAsJson(modules: List<ModuleResult>, project: String): String {
        if (modules.isEmpty()) return "[]"
        val payloads = modules.map { buildPayload(it, project) }
        val array = buildJsonArray {
            for (p in payloads) {
                addJsonObject {
                    put("title", p.title)
                    put("content", p.content)
                    put("tags", p.tags)
                    put("project", p.project)
                }
            }
        }
        return array.toString()
    }

    private fun formatAsText(modules: List<ModuleResult>, project: String): String {
        if (modules.isEmpty()) return "No modules indexed yet. Run indexing first."
        val payloads = modules.map { buildPayload(it, project) }
        return payloads.joinToString("\n") { p ->
            "--- ${p.title} ---\n${p.content}\nTags: ${p.tags}\nProject: ${p.project}\n"
        }
    }

    private data class KbPayload(
        val title: String,
        val content: String,
        val tags: String,
        val project: String
    )
}
