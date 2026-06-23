/** Reads a file from disk and ingests it via IngestPipeline with deduplication. */
package com.codeintel.memory.ingest

import com.codeintel.log
import java.nio.file.Path
import kotlin.io.path.exists
import kotlin.io.path.readText

/** Executes file-based ingestion — resolves path, checks dedup, delegates to pipeline. */
class IngestFileExecutor(
    private val pipeline: IngestPipeline,
    private val workspace: String,
    private val deduplicator: IngestDeduplicator? = null
) {

    /** Ingest a file, returns IngestResult or null if file not found. */
    fun ingest(filePath: String, type: String, format: String): IngestResult? {
        val path = resolvePath(filePath)
        if (!path.exists()) {
            log("IngestFileExecutor: file not found — $path")
            return null
        }

        // Dedup check: skip if file unchanged
        if (deduplicator != null) {
            val check = deduplicator.check(path)
            if (!check.needsReindex) {
                log("IngestFileExecutor: SKIP $filePath — ${check.reason}")
                return IngestResult(
                    source = filePath,
                    entriesCreated = 0,
                    entryIds = emptyList(),
                    skipped = true,
                    skipReason = check.reason
                )
            }
        }

        val text = path.readText(Charsets.UTF_8)
        log("IngestFileExecutor: read ${text.length} chars from $path")

        val result = when (format) {
            "markdown" -> pipeline.ingestMarkdown(text, filePath, type)
            else -> pipeline.ingestText(text, filePath, type)
        }

        // Record in cache after successful ingest
        deduplicator?.recordIngested(path, result.entriesCreated)
        return result
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
