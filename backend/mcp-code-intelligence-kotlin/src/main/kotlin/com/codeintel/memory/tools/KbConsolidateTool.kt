/** kb_consolidate tool — trigger tier consolidation. */
package com.codeintel.memory.tools

import com.codeintel.memory.consolidation.TierConsolidator
import kotlinx.serialization.json.JsonObject

class KbConsolidateTool(private val consolidator: TierConsolidator) {

    /** Execute kb_consolidate — runs consolidation cycle. */
    fun execute(args: JsonObject): String {
        val result = consolidator.consolidate()
        return buildString {
            appendLine("Consolidation complete:")
            appendLine("  Promoted: ${result.promoted}")
            appendLine("  Demoted: ${result.demoted}")
            appendLine("  Expired: ${result.expired}")
        }
    }
}
