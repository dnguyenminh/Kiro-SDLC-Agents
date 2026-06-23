/** kb_ingest_doc tool — ingest document by file path (zero-context) or content. */
package com.codeintel.memory.tools

import com.codeintel.log
import com.codeintel.memory.ingest.IngestPipeline
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.nio.file.Path
import kotlin.io.path.exists
import kotlin.io.path.readText

class KbIngestDocTool(
    private val pipeline: IngestPipeline,
    private val workspace: String = ""
) {

    /** Execute kb_ingest_doc — file_path or source as path (zero-context), or inline content. */
    fun execute(args: JsonObject): String {
        log("kb_ingest_doc args: $args")
        val filePath = args["file_path"]?.jsonPrimitive?.content
        val content = args["content"]?.jsonPrimitive?.content
        val source = args["source"]?.jsonPrimitive?.content
        val format = args["format"]?.jsonPrimitive?.content ?: "markdown"
        val type = args["type"]?.jsonPrimitive?.content ?: "CONTEXT"

        val (text, resolvedSource) = resolveInput(filePath, content, source)
            ?: return "Error: provide file_path, source (as path), or content"

        val result = when (format) {
            "markdown" -> pipeline.ingestMarkdown(text, resolvedSource, type)
            else -> pipeline.ingestText(text, resolvedSource, type)
        }
        return "Document ingested: ${result.entriesCreated} entries from $resolvedSource (server-side read)"
    }

    private fun resolveInput(filePath: String?, content: String?, source: String?): Pair<String, String>? {
        // Priority 1: explicit file_path
        if (filePath != null) return readFromDisk(filePath)
        // Priority 2: content looks like a file path → read from disk (zero-context mode)
        if (content != null && looksLikePath(content)) {
            val fromDisk = readFromDisk(content)
            if (fromDisk != null) return fromDisk
        }
        // Priority 3: source looks like a file path → read from disk
        if (content == null && source != null && looksLikePath(source)) {
            return readFromDisk(source)
        }
        // Priority 4: inline content
        if (content != null) return Pair(content, source ?: "inline")
        // Priority 5: source as path
        if (source != null) return readFromDisk(source)
        return null
    }

    private fun looksLikePath(s: String): Boolean {
        return s.endsWith(".md") || s.endsWith(".txt") || s.contains("/") || s.contains("\\")
    }

    private fun readFromDisk(filePath: String): Pair<String, String>? {
        val path = resolvePath(filePath)
        if (!path.exists()) {
            log("File not found: $path (tried workspace=$workspace, cwd=${System.getProperty("user.dir")})")
            return null
        }
        val text = path.readText(Charsets.UTF_8)
        log("Read ${text.length} chars from $path")
        return Pair(text, filePath)
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
