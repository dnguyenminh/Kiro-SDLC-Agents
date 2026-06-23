/** Budget Allocator — allocates token budget across ranked results. KSA-171. */
package com.codeintel.context

import com.codeintel.context.models.AllocatedResult
import com.codeintel.context.models.MergedResult
import kotlin.math.ceil
import kotlin.math.max

class BudgetAllocator {

    private val budgetMgr = TokenBudgetManager(4000)

    /** Allocate token budget across merged results with progressive detail. */
    fun allocate(results: List<MergedResult>, maxTokens: Int): List<AllocatedResult> {
        val allocated = mutableListOf<AllocatedResult>()
        var tokensUsed = 100 // Response overhead

        val highThreshold = max(1, ceil(results.size * 0.2).toInt())
        val medThreshold = ceil(results.size * 0.6).toInt()

        for ((i, result) in results.withIndex()) {
            if (tokensUsed >= maxTokens) break

            var detail: String
            var content: String
            var tokens: Int

            if (i < highThreshold) {
                detail = "full"
                content = result.sourceCode ?: result.content ?: result.signature ?: result.name
                tokens = budgetMgr.countTokens(content)
            } else if (i < medThreshold) {
                detail = "signature"
                content = result.signature ?: result.name
                tokens = budgetMgr.countTokens(content)
            } else {
                detail = "reference"
                content = "${result.name} (${result.file ?: "unknown"}:${result.line ?: 0})"
                tokens = 15
            }

            // Downgrade if exceeds budget
            if (tokensUsed + tokens > maxTokens && detail == "full") {
                detail = "signature"
                content = result.signature ?: result.name
                tokens = budgetMgr.countTokens(content)
            }

            if (tokensUsed + tokens <= maxTokens) {
                allocated.add(AllocatedResult(
                    name = result.name,
                    id = result.id,
                    kind = result.kind,
                    file = result.file,
                    line = result.line,
                    signature = result.signature,
                    content = content,
                    relevanceScore = result.relevanceScore,
                    sources = result.sources,
                    relationship = result.relationship,
                    detail = detail,
                    tokens = tokens,
                ))
                tokensUsed += tokens
            }
        }

        return allocated
    }
}
