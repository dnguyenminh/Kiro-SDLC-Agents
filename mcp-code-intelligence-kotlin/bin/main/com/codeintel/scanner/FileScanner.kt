/** File scanner — traverses workspace, respects .gitignore, detects language. */
package com.codeintel.scanner

import com.codeintel.Config
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest
import kotlin.io.path.*

data class FileInfo(
    val absolutePath: String,
    val relativePath: String,
    val language: String,
    val contentHash: String,
    val sizeBytes: Long,
    val lineCount: Int
)

/** Scan workspace and return list of indexable files. */
fun scanWorkspace(config: Config): List<FileInfo> {
    val workspace = Path.of(config.workspace)
    val gitignore = loadGitignore(workspace)
    val results = mutableListOf<FileInfo>()
    traverse(workspace, workspace, config, gitignore, results)
    return results
}

/** Scan a single file and return metadata. */
fun scanSingleFile(filePath: String, workspace: String): FileInfo? {
    val path = Path.of(filePath)
    if (!path.exists()) return null
    val lang = detectLanguage(filePath) ?: return null
    val content = path.readText(Charsets.UTF_8)
    val rel = Path.of(workspace).relativize(path).toString().replace("\\", "/")
    return buildFileInfo(filePath, rel, lang, content)
}

/** Detect language from file extension. */
fun detectLanguage(filePath: String): String? {
    val ext = getExtension(filePath)
    return EXTENSION_LANGUAGE_MAP[ext]
}

private fun traverse(
    dir: Path, workspace: Path, config: Config,
    gitignore: List<String>, results: MutableList<FileInfo>
) {
    val entries = try { Files.list(dir).sorted().toList() } catch (_: Exception) { return }
    for (entry in entries) {
        val rel = workspace.relativize(entry).toString().replace("\\", "/")
        if (shouldExclude(rel, entry.name, config.excludePatterns, gitignore)) continue
        if (entry.isDirectory()) traverse(entry, workspace, config, gitignore, results)
        else processFile(entry, rel, config)?.let { results.add(it) }
    }
}

private fun processFile(entry: Path, relPath: String, config: Config): FileInfo? {
    val lang = detectLanguage(entry.toString()) ?: return null
    val ext = getExtension(entry.toString())
    if (ext !in config.includeExtensions && ext != ".kts") return null
    val size = entry.fileSize()
    if (size > config.maxFileSize) return null
    val content = try { entry.readText(Charsets.UTF_8) } catch (_: Exception) { return null }
    if (isBinary(content)) return null
    return buildFileInfo(entry.toString(), relPath, lang, content)
}

private fun buildFileInfo(absPath: String, relPath: String, lang: String, content: String) = FileInfo(
    absolutePath = absPath,
    relativePath = relPath,
    language = lang,
    contentHash = hashContent(content),
    sizeBytes = content.toByteArray().size.toLong(),
    lineCount = content.count { it == '\n' } + 1
)

private fun shouldExclude(relPath: String, name: String, excludes: List<String>, gitignore: List<String>): Boolean {
    if (name.startsWith(".") && name != ".") return true
    if (excludes.any { it in relPath || name == it }) return true
    if (gitignore.any { relPath.startsWith(it) || "/$it" in relPath }) return true
    return false
}

private fun isBinary(content: String): Boolean = content.take(1024).count { it == '\u0000' } > 2

private fun hashContent(content: String): String {
    val digest = MessageDigest.getInstance("SHA-256")
    return digest.digest(content.toByteArray()).take(8).joinToString("") { "%02x".format(it) }
}

private fun getExtension(filePath: String): String {
    if (filePath.endsWith(".gradle.kts")) return ".kts"
    val dot = filePath.lastIndexOf('.')
    return if (dot >= 0) filePath.substring(dot).lowercase() else ""
}

private fun loadGitignore(workspace: Path): List<String> {
    val file = workspace.resolve(".gitignore")
    if (!file.exists()) return emptyList()
    return try {
        file.readLines().filter { it.isNotBlank() && !it.startsWith("#") }
            .map { it.trim().trimEnd('/') }
    } catch (_: Exception) { emptyList() }
}

val EXTENSION_LANGUAGE_MAP = mapOf(
    ".ts" to "typescript", ".tsx" to "typescript",
    ".js" to "javascript", ".jsx" to "javascript",
    ".kt" to "kotlin", ".kts" to "kotlin",
    ".java" to "java", ".py" to "python",
    ".go" to "go", ".rs" to "rust",
    ".c" to "c", ".h" to "c",
    ".cpp" to "cpp", ".hpp" to "cpp",
    ".cs" to "csharp", ".rb" to "ruby",
    ".php" to "php", ".swift" to "swift",
    ".scala" to "scala", ".sql" to "sql",
    ".sh" to "bash", ".ps1" to "powershell",
    ".yaml" to "yaml", ".yml" to "yaml",
    ".json" to "json", ".toml" to "toml"
)
