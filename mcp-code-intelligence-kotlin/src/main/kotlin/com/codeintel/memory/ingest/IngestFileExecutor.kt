/** Reads a file from disk and ingests it via IngestPipeline. */
package com.codeintel.memory.ingest

import com.codeintel.log
import java.nio.file.Path
import kotlin.io.path.exists
import kotlin.io.path.readText

/** Executes file-based ingestion — resolves path, reads content, delegates to pipeline. */
class IngestFileExecutor(
    private val pipeline: IngestPipeline,
    private val workspace: String
) {

    /** Ingest a file, returns IngestResult or null if file not found. */
    fun ingest(filePath: String, type: String, format: String): IngestResult? {
        val path = resolvePath(filePath)
        if (!path.exists()) {
            log("IngestFileExecutor: file not found — $path")
            return null
        }
        val text = path.readText(Charsets.UTF_8)
        log("IngestFileExecutor: read ${text.length} chars from $path")
        return when (format) {
            "markdown" -> pipeline.ingestMarkdown(text, filePath, type)
            else -> pipeline.ingestText(text, filePath, type)
        }
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
