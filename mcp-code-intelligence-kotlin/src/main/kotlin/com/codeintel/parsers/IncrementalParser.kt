/**
 * KSA-171/172: Incremental Parser — Change tracking for efficient re-parsing.
 * Only re-parses changed files, caches AST results by content hash.
 */
package com.codeintel.parsers

import java.io.File
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

data class CachedAST(
    val parseResult: ParseResult,
    val contentHash: String,
    val timestamp: Long = System.currentTimeMillis(),
)

class IncrementalParser(
    private val registry: GrammarRegistry,
    private val maxCacheSize: Int = 1000,
) {
    private val cache = ConcurrentHashMap<String, CachedAST>()

    fun parse(filePath: String, source: String): ParseResult {
        val hash = computeHash(source)
        val cached = cache[filePath]
        if (cached != null && cached.contentHash == hash) {
            return cached.parseResult
        }
        val parser = registry.getParser(filePath) ?: return ParseResult()
        val result = parser.parse(source, filePath)
        evictIfNeeded()
        cache[filePath] = CachedAST(result, hash)
        return result
    }

    fun parseFile(file: File, relativePath: String): ParseResult {
        if (!file.exists() || file.length() > MAX_FILE_SIZE) return ParseResult()
        val source = try { file.readText() } catch (_: Exception) { return ParseResult() }
        return parse(relativePath, source)
    }

    fun invalidate(filePath: String) {
        cache.remove(filePath)
    }

    fun invalidateAll() {
        cache.clear()
    }

    fun getCachedResult(filePath: String): ParseResult? = cache[filePath]?.parseResult

    fun isCached(filePath: String): Boolean = cache.containsKey(filePath)

    fun cacheSize(): Int = cache.size

    private fun evictIfNeeded() {
        if (cache.size >= maxCacheSize) {
            val oldest = cache.entries
                .sortedBy { it.value.timestamp }
                .take(cache.size / 4)
            oldest.forEach { cache.remove(it.key) }
        }
    }

    companion object {
        private const val MAX_FILE_SIZE = 1_048_576L

        fun computeHash(content: String): String {
            val digest = MessageDigest.getInstance("SHA-256")
            val bytes = digest.digest(content.toByteArray())
            return bytes.joinToString("") { "%02x".format(it) }.take(16)
        }
    }
}
