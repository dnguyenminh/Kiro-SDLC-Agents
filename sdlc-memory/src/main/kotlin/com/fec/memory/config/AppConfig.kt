package com.fec.memory.config

import java.nio.file.Path
import java.nio.file.Paths

/**
 * Application configuration resolved from CLI args and env vars.
 */
data class AppConfig(
    val workspace: Path,
    val viewerPort: Int = 3200,
    val dbPath: Path = workspace.resolve(".sdlc-memory/memory.db"),
    val modelPath: Path = workspace.resolve(".sdlc-memory/models"),
) {
    companion object {
        fun fromArgs(args: Array<String>): AppConfig {
            val argsMap = parseArgs(args)
            val workspace = resolveWorkspace(argsMap)
            val port = argsMap["viewer-port"]?.toIntOrNull() ?: 3200
            return AppConfig(workspace = workspace, viewerPort = port)
        }

        private fun parseArgs(args: Array<String>): Map<String, String> {
            val map = mutableMapOf<String, String>()
            var i = 0
            while (i < args.size) {
                val key = args[i].removePrefix("--")
                val value = args.getOrNull(i + 1) ?: ""
                map[key] = value
                i += 2
            }
            return map
        }

        private fun resolveWorkspace(args: Map<String, String>): Path {
            val ws = args["workspace"]
                ?: System.getenv("SDLC_MEMORY_WORKSPACE")
                ?: System.getProperty("user.dir")
            return Paths.get(ws).toAbsolutePath()
        }
    }
}
