/** stream_write_file tool — writes content directly to local disk. */
package com.codeintel.tools

import kotlinx.serialization.json.*
import java.io.File

class StreamWriteFileTool(private val workspace: String) {

    fun execute(args: JsonObject): String {
        val rawPath = args["file_path"]?.jsonPrimitive?.content ?: return """{"error":"file_path is required"}"""
        val mode = args["mode"]?.jsonPrimitive?.content ?: "write"
        val content = args["content"]?.jsonPrimitive?.content ?: ""

        val file = resolveFile(rawPath)
        file.parentFile?.mkdirs()

        val fileExists = file.exists()
        val sizeBefore = if (fileExists) file.length() else 0L

        if (fileExists && content.isEmpty()) {
            return buildResult(file.absolutePath, 0, sizeBefore, sizeBefore, "no-op", "File exists, no content provided")
        }
        if (mode == "create" && fileExists) {
            return buildResult(file.absolutePath, 0, sizeBefore, sizeBefore, "error", "File already exists")
        }

        writeContent(file, content, mode, fileExists)
        val totalSize = file.length()
        return buildResult(file.absolutePath, totalSize - sizeBefore, totalSize, sizeBefore, mode, null)
    }

    private fun resolveFile(rawPath: String): File {
        val f = File(rawPath)
        return if (f.isAbsolute) f else File(workspace, rawPath)
    }

    private fun writeContent(file: File, content: String, mode: String, exists: Boolean) {
        if (mode == "append" && exists) {
            file.appendText(content)
        } else {
            file.writeText(content)
        }
    }

    private fun buildResult(path: String, written: Long, total: Long, before: Long, mode: String, msg: String?): String {
        val msgPart = if (msg != null) ""","message":"$msg"""" else ""
        return """{"file_path":"$path","bytes_written":$written,"total_size":$total,"file_size_before":$before,"mode":"$mode"$msgPart}"""
    }
}
