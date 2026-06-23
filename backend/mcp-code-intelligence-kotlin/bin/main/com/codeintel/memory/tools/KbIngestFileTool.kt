/** kb_ingest_file tool — ingest document from disk by file path (zero-context). */
package com.codeintel.memory.tools

import com.codeintel.log
import com.codeintel.memory.ingest.IngestPipeline
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.nio.file.Path
import kotlin.io.path.exists
import kotlin.io.path.readText

class KbIngestFileTool(
    private val pipeline: IngestPipeline,
    private val workspace: String
) {

    /** Execute — server reads file from disk, agent only sends path. */
    fun execute(args: JsonObject): String {
        val filePath = args["file_path"]?.jsonPrimitive?.content
            ?: return "Error: file_path is required"
        val type = args["type"]?.jsonPrimitive?.content ?: "CONTEXT"
        val format = args["format"]?.jsonPrimitive?.content ?: "markdown"

        val path = resolvePath(filePath)
        if (!path.exists()) {
            return "Error: file not found — $path (workspace=$workspace)"
        }

        val text = path.readText(Charsets.UTF_8)
        log("kb_ingest_file: read ${text.length} chars from $path")

        val result = when (format) {
            "markdown" -> pipeline.ingestMarkdown(text, filePath, type)
            else -> pipeline.ingestText(text, filePath, type)
        }
        return "Ingested: ${result.entriesCreated} entries from $filePath"
    }

    private fun resolvePath(filePath: String): Path {
        val p = Path.of(filePath)
        if (p.isAbsolute && p.exists()) return p
        if (workspace.isNotBlank()) {
            val wsPath = Path.of(workspace, filePath)
            if (wsPath.exists()) return wsPath
        }
        val cwdPath = Path.of(System.getProperty("user.dir"), filePath)
        if (cwdPath.exists()) return cwdPath
        return if (workspace.isNotBlank()) Path.of(workspace, filePath) else p
    }
}
