/** kb_status tool — get memory system statistics. */
package com.codeintel.memory.tools

import com.codeintel.memory.MemoryEngine
import kotlinx.serialization.json.JsonObject

class KbStatusTool(private val engine: MemoryEngine) {

    /** Execute kb_status — returns memory system stats. */
    fun execute(args: JsonObject): String {
        val stats = engine.getStats()
        val tierStats = engine.consolidation.getTierStats()

        val lines = mutableListOf(
            "Memory Engine Status:",
            "  Total entries: ${stats.totalEntries}",
            "  Total edges: ${stats.totalEdges}",
            "  Total vectors: ${stats.totalVectors}",
            "",
            "Tier Breakdown:"
        )
        for (ts in tierStats) {
            lines.add("  ${ts.tier}: ${ts.entryCount} entries (avg confidence: ${"%.2f".format(ts.avgConfidence)}, avg access: ${"%.1f".format(ts.avgAccessCount)})")
        }
        if (tierStats.isEmpty()) lines.add("  (empty)")
        return lines.joinToString("\n")
    }
}
