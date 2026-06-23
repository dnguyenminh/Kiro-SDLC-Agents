/** Token Budget Manager — estimates tokens and assembles context within budget. KSA-171.
 *
 * Uses jtokkit for accurate GPT-family token counting.
 */
package com.codeintel.context

class TokenBudgetManager(budget: Int) {

    private val budget: Int = maxOf(budget, 500)
    private var consumed: Int = 0

    /** Count tokens using jtokkit (if available) or fallback (~4 chars/token). */
    fun countTokens(content: Any?): Int {
        val text = when (content) {
            is String -> content
            null -> ""
            else -> content.toString()
        }
        return JtokkitHolder.countTokens(text)
    }

    fun canFit(tokens: Int): Boolean = consumed + tokens <= budget

    fun consume(tokens: Int) { consumed += tokens }

    fun consumeAll() { consumed = budget }

    fun remaining(): Int = maxOf(0, budget - consumed)

    fun used(): Int = consumed

    fun isExhausted(): Boolean = remaining() < 50

    /** Truncate string content to fit remaining budget. */
    fun truncateToFit(content: String): String {
        val maxChars = remaining() * 4
        return if (content.length <= maxChars) content
        else content.substring(0, maxChars) + "\n... (truncated)"
    }

    /** Truncate list content to fit remaining budget. */
    fun <T> truncateListToFit(content: List<T>): List<T> {
        val maxChars = remaining() * 4
        val result = mutableListOf<T>()
        var chars = 0
        for (item in content) {
            val itemStr = item.toString()
            if (chars + itemStr.length > maxChars) break
            result.add(item)
            chars += itemStr.length
        }
        return result
    }

    /**
     * Assemble sections within token budget.
     * Sections: Map<name, Pair<content, priority>>
     */
    fun assemble(
        sections: Map<String, Pair<String, Int>>,
        budget: Int,
    ): AssembleResult {
        val sorted = sections.entries
            .filter { it.value.first.isNotEmpty() }
            .sortedBy { it.value.second }

        val result = mutableMapOf<String, String>()
        var usedTokens = 0
        val included = mutableListOf<String>()
        val excluded = mutableListOf<String>()

        for ((key, pair) in sorted) {
            val (content, _) = pair
            val tokens = countTokens(content)

            if (usedTokens + tokens <= budget) {
                result[key] = content
                usedTokens += tokens
                included.add(key)
            } else {
                excluded.add(key)
            }
        }

        return AssembleResult(result, usedTokens, included, excluded)
    }
}

data class AssembleResult(
    val result: Map<String, String>,
    val tokenCount: Int,
    val included: List<String>,
    val excluded: List<String>,
)

/** Singleton holder for jtokkit encoder. Falls back to char-based estimation. */
private object JtokkitHolder {
    private val encoder: Any? = try {
        val registryClass = Class.forName("com.knuddels.jtokkit.Encodings")
        val registry = registryClass.getMethod("newDefaultEncodingRegistry").invoke(null)
        val encodingType = Class.forName("com.knuddels.jtokkit.api.EncodingType")
        val cl100k = encodingType.getField("CL100K_BASE").get(null)
        registry.javaClass.getMethod("getEncoding", encodingType).invoke(registry, cl100k)
    } catch (_: Exception) {
        null
    }

    fun countTokens(text: String): Int {
        if (encoder == null) return text.length / 4 + 1
        return try {
            val result = encoder.javaClass.getMethod("encode", String::class.java).invoke(encoder, text)
            (result as List<*>).size
        } catch (_: Exception) {
            text.length / 4 + 1
        }
    }
}
