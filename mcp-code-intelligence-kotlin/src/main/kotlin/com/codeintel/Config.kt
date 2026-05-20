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
import java.io.File
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
    val viewerPort: Int = 3200,
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
        private var configPath: String? = null
        private var depth: Int = 0
        private var maxDepth: Int = 5

        /** Orchestration config file path (--config arg). Null = no orchestration. */
        val orchestrationConfigPath: String? get() = configPath

        /** Current recursion depth in process tree (--depth arg). */
        val currentDepth: Int get() = depth

        /** Maximum allowed recursion depth (--max-depth arg). */
        val maxRecursionDepth: Int get() = maxDepth

        /** Store CLI args for workspace resolution + orchestration config. */
        fun setCliArgs(args: Array<String>) {
            cliArgs = args
            parseOrchestrationArgs(args)
        }

        private fun parseOrchestrationArgs(args: Array<String>) {
            val configIdx = args.indexOf("--config")
            if (configIdx >= 0 && configIdx + 1 < args.size) {
                configPath = args[configIdx + 1]
            }
            val depthIdx = args.indexOf("--depth")
            if (depthIdx >= 0 && depthIdx + 1 < args.size) {
                depth = args[depthIdx + 1].toIntOrNull() ?: 0
            }
            val maxDepthIdx = args.indexOf("--max-depth")
            if (maxDepthIdx >= 0 && maxDepthIdx + 1 < args.size) {
                maxDepth = args[maxDepthIdx + 1].toIntOrNull() ?: 5
            }
        }

        /** Load initial config — checks CLI args, env, then cwd. */
        fun load(): Config {
            val workspace = resolveWorkspaceFromCli()
                ?: resolveWorkspaceFromEnv()
            return buildConfig(workspace)
        }

        /** Set workspace from MCP initialize roots (only if CLI/env not set). */
        fun withWorkspace(rootUri: String?): Config {
            // CLI arg takes highest priority
            if (resolveWorkspaceFromCli() != null) return load()
            // Env var (may not be available on Windows via Kiro)
            val env = System.getenv("CODE_INTEL_WORKSPACE")
            if (!env.isNullOrBlank()) return load()
            // System property (-D flag)
            val prop = System.getProperty("CODE_INTEL_WORKSPACE")
            if (!prop.isNullOrBlank()) return buildConfig(Path.of(prop).toAbsolutePath().toString())
            // Detect workspace from JAR location
            val jarWorkspace = resolveWorkspaceFromJarLocation()
            log("DEBUG withWorkspace: env=$env, prop=$prop, jarWs=$jarWorkspace, rootUri=$rootUri, cmd=${System.getProperty("sun.java.command")?.take(200)}")
            if (jarWorkspace != null) return buildConfig(jarWorkspace)
            // Finally try initialize roots
            val workspace = resolveWorkspaceFromRoots(rootUri)
            return buildConfig(workspace)
        }

        /** Parse --viewer-port from CLI args, system properties, or env vars. */
        fun resolveViewerPort(): Int {
            val idx = cliArgs.indexOf("--viewer-port")
            if (idx >= 0 && idx + 1 < cliArgs.size) {
                return cliArgs[idx + 1].toIntOrNull() ?: 3200
            }
            return System.getProperty("CODE_INTEL_VIEWER_PORT")?.toIntOrNull()
                ?: System.getenv("CODE_INTEL_VIEWER_PORT")?.toIntOrNull()
                ?: System.getenv("VIEWER_PORT")?.toIntOrNull()
                ?: 3200
        }

        private fun resolveWorkspaceFromCli(): String? {
            val idx = cliArgs.indexOf("--workspace")
            if (idx >= 0 && idx + 1 < cliArgs.size) {
                val raw = cliArgs[idx + 1]
                // Skip unresolved variables (e.g. ${workspaceFolder})
                if (raw.contains("\${")) return null
                return Path.of(raw).toAbsolutePath().toString()
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
    val prop = System.getProperty("CODE_INTEL_WORKSPACE")
    if (!prop.isNullOrBlank()) return Path.of(prop).toAbsolutePath().toString()
    // Detect from JAR location
    val jarWs = resolveWorkspaceFromJarLocation()
    if (jarWs != null) return jarWs
    log("⚠️ Workspace fallback to user.dir=${System.getProperty("user.dir")} — env and JAR detection both failed")
    return System.getProperty("user.dir")
}

/** Detect workspace from JAR file location (JAR is at workspace/mcp-code-intelligence-kotlin/build/libs/). */
private fun resolveWorkspaceFromJarLocation(): String? {
    try {
        // Method 1: From sun.java.command (contains full JAR path on most JVMs)
        val cmd = System.getProperty("sun.java.command") ?: ""
        val jarMatch = Regex("""(.+[/\\]mcp-code-intelligence-kotlin[/\\]build[/\\]libs[/\\][^"'\s]+\.jar)""").find(cmd)
        if (jarMatch != null) {
            val jarPath = Path.of(jarMatch.groupValues[1])
            val candidate = jarPath.parent?.parent?.parent?.parent
            if (candidate != null && candidate.resolve("shared").resolve("viewer").resolve("index.html").toFile().exists()) {
                return candidate.toAbsolutePath().toString()
            }
        }
        // Method 2: From java.class.path
        val classPath = System.getProperty("java.class.path") ?: ""
        for (entry in classPath.split(File.pathSeparator)) {
            if (entry.contains("mcp-code-intelligence-kotlin") && entry.contains("build")) {
                val jarPath = Path.of(entry)
                val candidate = jarPath.parent?.parent?.parent?.parent
                if (candidate != null && candidate.resolve("shared").resolve("viewer").resolve("index.html").toFile().exists()) {
                    return candidate.toAbsolutePath().toString()
                }
            }
        }
        // Method 3: From protectionDomain
        val url = Config::class.java.protectionDomain?.codeSource?.location
        if (url != null) {
            val jarFile = Path.of(url.toURI())
            val candidate = jarFile.parent?.parent?.parent?.parent
            if (candidate != null && candidate.resolve("shared").resolve("viewer").resolve("index.html").toFile().exists()) {
                return candidate.toAbsolutePath().toString()
            }
        }
    } catch (_: Exception) {}
    return null
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
        viewerPort = Config.resolveViewerPort(),
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
