/**
 * Configuration loading — environment variables and config file.
 * Workspace resolution priority:
 * 1. --workspace CLI arg (highest — Kiro resolves ${workspaceFolder})
 * 2. CODE_INTEL_WORKSPACE env var
 * 3. initialize.roots[0].uri (MCP protocol)
 * 4. cwd() (lowest fallback)
 */
package com.codeintel

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.net.URI
import java.nio.file.Path
import kotlin.io.path.exists
import kotlin.io.path.readText

@Serializable
data class FileConfig(
    val watchEnabled: Boolean = true,
    val watchDebounceMs: Long = 500,
    val ollamaUrl: String? = null,
    val ollamaModel: String = "nomic-embed-text",
    val excludePatterns: List<String> = DEFAULT_EXCLUDE,
    val includeExtensions: List<String> = DEFAULT_EXTENSIONS,
    val maxFileSize: Long = 512_000
)

data class Config(
    val workspace: String,
    val dbPath: String,
    val watchEnabled: Boolean,
    val watchDebounceMs: Long,
    val ollamaUrl: String?,
    val ollamaModel: String,
    val excludePatterns: List<String>,
    val includeExtensions: List<String>,
    val maxFileSize: Long
) {
    companion object {
        private var cliArgs: Array<String> = emptyArray()

        /** Store CLI args for workspace resolution. */
        fun setCliArgs(args: Array<String>) {
            cliArgs = args
        }

        /** Load initial config — checks CLI args, env, then cwd. */
        fun load(): Config {
            val workspace = resolveWorkspaceFromCli()
                ?: resolveWorkspaceFromEnv()
            return buildConfig(workspace)
        }

        /** Set workspace from MCP initialize roots (only if CLI/env not set). */
        fun withWorkspace(rootUri: String?): Config {
            // CLI arg and env var take priority over initialize roots
            if (resolveWorkspaceFromCli() != null) return load()
            val env = System.getenv("CODE_INTEL_WORKSPACE")
            if (!env.isNullOrBlank()) return load()
            val workspace = resolveWorkspaceFromRoots(rootUri)
            return buildConfig(workspace)
        }

        private fun resolveWorkspaceFromCli(): String? {
            val idx = cliArgs.indexOf("--workspace")
            if (idx >= 0 && idx + 1 < cliArgs.size) {
                return Path.of(cliArgs[idx + 1]).toAbsolutePath().toString()
            }
            return null
        }
    }
}

/** Convert a file:// URI to a local filesystem path. */
fun fileUriToPath(uri: String): String {
    return try {
        Path.of(URI(uri)).toAbsolutePath().toString()
    } catch (e: Exception) {
        // Fallback: manual strip
        val path = uri.removePrefix("file:///")
        if (path.length >= 2 && path[1] == ':') path else "/$path"
    }
}

private val json = Json { ignoreUnknownKeys = true }

private fun resolveWorkspaceFromEnv(): String {
    val env = System.getenv("CODE_INTEL_WORKSPACE")
    if (!env.isNullOrBlank()) return Path.of(env).toAbsolutePath().toString()
    return System.getProperty("user.dir")
}

private fun resolveWorkspaceFromRoots(rootUri: String?): String {
    // Env var always takes priority (backward compat)
    val env = System.getenv("CODE_INTEL_WORKSPACE")
    if (!env.isNullOrBlank()) return Path.of(env).toAbsolutePath().toString()

    if (!rootUri.isNullOrBlank()) {
        return Path.of(fileUriToPath(rootUri)).toAbsolutePath().toString()
    }
    return System.getProperty("user.dir")
}

private fun buildConfig(workspace: String): Config {
    val codeIntelDir = Path.of(workspace, ".code-intel")
    val configPath = codeIntelDir.resolve("config.json")
    val fileCfg = loadFileConfig(configPath)

    return Config(
        workspace = workspace,
        dbPath = codeIntelDir.resolve("index.db").toString(),
        watchEnabled = envBool("CODE_INTEL_WATCH", fileCfg.watchEnabled),
        watchDebounceMs = envLong("CODE_INTEL_DEBOUNCE", fileCfg.watchDebounceMs),
        ollamaUrl = System.getenv("OLLAMA_URL") ?: fileCfg.ollamaUrl,
        ollamaModel = System.getenv("OLLAMA_MODEL") ?: fileCfg.ollamaModel,
        excludePatterns = fileCfg.excludePatterns,
        includeExtensions = fileCfg.includeExtensions,
        maxFileSize = fileCfg.maxFileSize
    )
}

private fun loadFileConfig(path: Path): FileConfig {
    if (!path.exists()) return FileConfig()
    return try {
        json.decodeFromString<FileConfig>(path.readText())
    } catch (e: Exception) {
        log("Failed to read config: ${e.message}")
        FileConfig()
    }
}

private fun envBool(key: String, fallback: Boolean): Boolean {
    val v = System.getenv(key) ?: return fallback
    return v in listOf("1", "true", "True")
}

private fun envLong(key: String, fallback: Long): Long {
    val v = System.getenv(key) ?: return fallback
    return v.toLongOrNull() ?: fallback
}

val DEFAULT_EXCLUDE = listOf(
    "node_modules", ".git", "dist", "build", ".gradle",
    ".idea", ".vscode", "__pycache__", ".venv", "target",
    ".code-intel", "coverage", ".next", ".nuxt"
)

val DEFAULT_EXTENSIONS = listOf(
    ".ts", ".tsx", ".js", ".jsx", ".kt", ".java", ".py",
    ".go", ".rs", ".c", ".cpp", ".h", ".hpp", ".cs",
    ".rb", ".php", ".swift", ".scala", ".sql", ".sh",
    ".yaml", ".yml", ".json", ".toml"
)
