/** Git Service — wraps git log for file history. KSA-171. */
package com.codeintel.context

import com.codeintel.context.models.GitCommit
import java.io.File
import java.util.concurrent.TimeUnit

class GitService(private val workspaceRoot: String) {

    /** Get recent commit history for a file. */
    fun getFileHistory(filePath: String, limit: Int = 5): List<GitCommit> {
        return try {
            val process = ProcessBuilder("git", "log", "--oneline", "--follow", "-n$limit", "--", filePath)
                .directory(File(workspaceRoot))
                .redirectErrorStream(true)
                .start()
            val completed = process.waitFor(5, TimeUnit.SECONDS)
            if (!completed || process.exitValue() != 0) return emptyList()

            process.inputStream.bufferedReader().readLines()
                .filter { it.isNotBlank() }
                .map { line ->
                    val spaceIdx = line.indexOf(' ')
                    GitCommit(
                        hash = line.substring(0, spaceIdx),
                        message = line.substring(spaceIdx + 1),
                    )
                }
        } catch (_: Exception) {
            emptyList()
        }
    }

    /** Check if git is available in the workspace. */
    fun isAvailable(): Boolean {
        return try {
            val process = ProcessBuilder("git", "rev-parse", "--is-inside-work-tree")
                .directory(File(workspaceRoot))
                .redirectErrorStream(true)
                .start()
            process.waitFor(2, TimeUnit.SECONDS) && process.exitValue() == 0
        } catch (_: Exception) {
            false
        }
    }
}
