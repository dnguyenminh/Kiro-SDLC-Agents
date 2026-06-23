/** get_edit_context tool — source + callers + tests + git for editing. KSA-171. */
package com.codeintel.tools

import com.codeintel.context.EditContextService
import com.codeintel.context.models.EditContextParams
import com.codeintel.context.models.EditContextResult
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive

class EditContextTool(private val editService: EditContextService) {

    fun execute(args: JsonObject): String {
        val symbol = args["symbol"]?.jsonPrimitive?.content
            ?: return """{"error":"Parameter \"symbol\" is required"}"""

        val includeCallers = args["include_callers"]?.jsonPrimitive?.boolean ?: true
        val includeTests = args["include_tests"]?.jsonPrimitive?.boolean ?: true
        val includeGit = args["include_git"]?.jsonPrimitive?.boolean ?: true
        val tokenBudget = args["token_budget"]?.jsonPrimitive?.int ?: 4000
        val callerDepth = args["caller_depth"]?.jsonPrimitive?.int ?: 1

        val params = EditContextParams(
            symbol = symbol,
            includeCallers = includeCallers,
            includeTests = includeTests,
            includeGit = includeGit,
            tokenBudget = tokenBudget,
            callerDepth = callerDepth,
        )

        val result = editService.getContext(params)
        return formatResult(result)
    }

    private fun formatResult(result: EditContextResult): String {
        val lines = mutableListOf<String>()
        lines.add("Edit Context: \"${result.symbol}\" [${result.kind}]")
        lines.add("File: ${result.file}:${result.line}")
        result.signature?.let { lines.add("Signature: $it") }
        lines.add("")

        lines.add("--- source ---")
        lines.add(result.source.take(2000))
        lines.add("")

        result.callers?.let { callers ->
            lines.add("--- callers (${callers.size}) ---")
            for (c in callers.take(10)) {
                lines.add("  ${c.symbol} @ ${c.file}:${c.line}")
            }
            lines.add("")
        }

        result.tests?.let { tests ->
            lines.add("--- tests (${tests.size}) ---")
            for (t in tests.take(5)) {
                lines.add("  ${t.testName} @ ${t.file}")
            }
            lines.add("")
        }

        result.gitHistory?.let { history ->
            lines.add("--- git history (${history.size}) ---")
            for (g in history.take(5)) {
                lines.add("  ${g.hash.take(7)} ${g.message}")
            }
            lines.add("")
        }

        result.siblings?.let { siblings ->
            lines.add("--- siblings (${siblings.size}) ---")
            for (s in siblings.take(10)) {
                lines.add("  [${s.kind}] ${s.name} L${s.line}")
            }
            lines.add("")
        }

        val m = result.metadata
        lines.add("Tokens: ${m.tokenCount}/${m.tokenBudget} | ${m.queryTimeMs}ms")
        if (m.sectionsIncluded.isNotEmpty()) lines.add("Included: ${m.sectionsIncluded.joinToString(", ")}")
        if (m.sectionsExcluded.isNotEmpty()) lines.add("Excluded: ${m.sectionsExcluded.joinToString(", ")}")
        return lines.joinToString("\n")
    }
}
