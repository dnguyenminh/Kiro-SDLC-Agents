/** code_index_status tool — get indexing status and statistics. */
package com.codeintel.tools

import com.codeintel.indexer.IndexingEngine
import com.codeintel.query.QueryLayer
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonPrimitive

class CodeIndexStatusTool(private val queryLayer: QueryLayer, private val indexer: IndexingEngine) {

    /** Execute code_index_status with given arguments. */
    fun execute(args: JsonObject): String {
        val reindex = args["reindex"]?.jsonPrimitive?.boolean ?: false
        if (reindex) runBlocking { indexer.runFullIndex() }
        val status = queryLayer.getIndexStatus()
        return formatStatus(status)
    }

    private fun formatStatus(status: com.codeintel.query.IndexStatus): String {
        val state = if (indexer.isRunning) "\uD83D\uDD04 Indexing..." else "\u2705 Idle"
        val lines = mutableListOf(
            "\uD83D\uDCCA Code Intelligence Index Status\n",
            "State: $state",
            "Files: ${status.totalFiles}",
            "Symbols: ${status.totalSymbols}",
            "Modules: ${status.totalModules}",
            "Last indexed: ${status.lastIndexed ?: "Never"}",
            "",
            "Languages:"
        )
        for ((lang, count) in status.languages) {
            lines.add("  $lang: $count files")
        }
        return lines.joinToString("\n")
    }
}
