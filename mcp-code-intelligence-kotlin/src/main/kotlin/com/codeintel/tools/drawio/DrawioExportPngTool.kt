/** drawio_export_png MCP tool — Export .drawio file to PNG image. */
package com.codeintel.tools.drawio

import kotlinx.serialization.json.*
import java.io.File

/**
 * Export .drawio diagram to PNG using draw.io CLI.
 * Priority: 1) drawio CLI on machine. If not available, tool is not published.
 */
class DrawioExportPngTool(private val workspace: String) {

    fun execute(args: JsonObject): String {
        val rawPath = args["file_path"]?.jsonPrimitive?.content
            ?: return jsonError("file_path is required")

        val file = resolveFile(rawPath)
        if (!file.exists()) return jsonError("File not found: $rawPath")
        if (!file.name.endsWith(".drawio")) return jsonError("File must have .drawio extension")

        val pngFile = File(file.absolutePath.replace(".drawio", ".png"))
        val relativePng = pngFile.relativeTo(File(workspace)).path.replace("\\", "/")

        val cliPath = findDrawioCli() ?: return jsonError("No renderer available. Install draw.io desktop app.")

        return try {
            exportWithCli(cliPath, file, pngFile)
            if (!pngFile.exists()) return jsonError("Export failed — PNG not created at $relativePng")
            buildSuccessResult(relativePng, pngFile.length())
        } catch (e: Exception) {
            jsonError("Export failed: ${e.message}")
        }
    }

    private fun exportWithCli(cliPath: String, input: File, output: File) {
        val process = ProcessBuilder(
            cliPath, "--export", "--format", "png",
            "--border", "10", "--output", output.absolutePath, input.absolutePath
        ).redirectErrorStream(true).start()
        val exited = process.waitFor(30, java.util.concurrent.TimeUnit.SECONDS)
        if (!exited) { process.destroyForcibly(); throw RuntimeException("Timeout after 30s") }
        if (process.exitValue() != 0) throw RuntimeException("CLI exit code: ${process.exitValue()}")
    }

    private fun buildSuccessResult(relativePath: String, sizeBytes: Long): String {
        return buildJsonObject {
            put("success", true)
            put("file_path", relativePath)
            put("size_bytes", sizeBytes)
            put("renderer", "drawio-cli")
        }.toString()
    }

    private fun resolveFile(rawPath: String): File {
        val f = File(rawPath)
        return if (f.isAbsolute) f else File(workspace, rawPath)
    }

    private fun jsonError(msg: String): String {
        return buildJsonObject {
            put("success", false)
            put("error", msg)
        }.toString()
    }

    companion object {
        private var cachedCliPath: String? = null
        private var cacheChecked = false

        /** Check if draw.io CLI is available on this machine. */
        fun isAvailable(): Boolean = findDrawioCli() != null

        private fun findDrawioCli(): String? {
            if (cacheChecked) return cachedCliPath
            cacheChecked = true
            cachedCliPath = findFromPath() ?: findFromKnownPaths()
            return cachedCliPath
        }

        private fun findFromPath(): String? {
            return try {
                val cmd = if (isWindows()) "where drawio" else "which drawio"
                val proc = Runtime.getRuntime().exec(cmd.split(" ").toTypedArray())
                val result = proc.inputStream.bufferedReader().readLine()?.trim()
                proc.waitFor()
                if (!result.isNullOrBlank() && File(result).exists()) result else null
            } catch (_: Exception) { null }
        }

        private fun findFromKnownPaths(): String? {
            return getPlatformCandidates().firstOrNull { it.isNotBlank() && File(it).isFile }
        }

        private fun getPlatformCandidates(): List<String> {
            val os = System.getProperty("os.name", "").lowercase()
            return when {
                os.contains("win") -> listOf(
                    "C:\\Program Files\\draw.io\\draw.io.exe",
                    "${System.getenv("LOCALAPPDATA") ?: ""}\\Programs\\draw.io\\draw.io.exe",
                    "${System.getenv("PROGRAMFILES") ?: ""}\\draw.io\\draw.io.exe",
                )
                os.contains("mac") -> listOf(
                    "/Applications/draw.io.app/Contents/MacOS/draw.io",
                    "/usr/local/bin/drawio",
                    "${System.getenv("HOME") ?: ""}/Applications/draw.io.app/Contents/MacOS/draw.io",
                )
                else -> listOf(
                    "/usr/bin/drawio", "/usr/local/bin/drawio", "/snap/bin/drawio",
                    "${System.getenv("HOME") ?: ""}/.local/bin/drawio",
                )
            }
        }

        private fun isWindows() = System.getProperty("os.name", "").lowercase().contains("win")
    }
}
