/** get_ai_context tool — intent-aware context assembly with token budgeting. KSA-171. */
package com.codeintel.tools

import com.codeintel.context.AIContextService
import com.codeintel.context.models.AIContextParams
import com.codeintel.context.models.AIContextResponse
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive

class AIContextTool(private val contextService: AIContextService) {

    fun execute(args: JsonObject): String {
        val symbol = args["symbol"]?.jsonPrimitive?.content
            ?: return """{"error":"Parameter \"symbol\" is required"}"""

        val intent = args["intent"]?.jsonPrimitive?.content ?: "explain"
        val tokenBudget = args["token_budget"]?.jsonPrimitive?.int ?: 4000
        val callerDepth = args["caller_depth"]?.jsonPrimitive?.int ?: 1

        val params = AIContextParams(
            symbol = symbol,
            intent = intent,
            tokenBudget = tokenBudget.coerceAtLeast(500),
            callerDepth = callerDepth.coerceIn(1, 5),
        )

        val result = contextService.getContext(params)
        return formatResult(result)
    }

    private fun formatResult(result: AIContextResponse): String {
        val lines = mutableListOf<String>()
        lines.add("AI Context: \"${result.symbol}\" [${result.kind}] (intent: ${result.intent})")
        lines.add("File: ${result.filePath}\n")

        for ((section, content) in result.context) {
            if (section.endsWith("_truncated")) continue
            val truncated = if (result.context["${section}_truncated"] == "true") " [TRUNCATED]" else ""
            lines.add("--- $section$truncated ---")
            lines.add(content.take(2000))
            lines.add("")
        }

        val m = result.metadata
        lines.add("Budget: ${m.budgetUsed}/${m.budgetTotal} tokens | ${m.queryTimeMs}ms")
        if (m.sectionsIncluded.isNotEmpty()) lines.add("Included: ${m.sectionsIncluded.joinToString(", ")}")
        if (m.sectionsOmitted.isNotEmpty()) lines.add("Omitted: ${m.sectionsOmitted.joinToString(", ")}")
        return lines.joinToString("\n")
    }
}
