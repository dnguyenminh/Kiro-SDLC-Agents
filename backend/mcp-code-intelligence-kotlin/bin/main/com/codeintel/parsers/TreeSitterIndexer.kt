/**
 * KSA-172: Tree-sitter Indexer — Orchestrates file parsing and database storage.
 */
package com.codeintel.parsers

import java.io.File
import java.sql.Connection

class TreeSitterIndexer(
    private val registry: GrammarRegistry,
    private val db: Connection,
    private val maxFileSize: Long = 1_048_576L,
) {
    fun indexFile(filePath: String, relativePath: String): IndexResult {
        val startTime = System.currentTimeMillis()
        val file = File(filePath)
        if (!file.exists() || file.length() > maxFileSize) {
            return IndexResult(relativePath, 0, 0, 0, System.currentTimeMillis() - startTime, "regex-fallback")
        }
        val source = try { file.readText() } catch (e: Exception) {
            return IndexResult(relativePath, 0, 0, 1, System.currentTimeMillis() - startTime, "regex-fallback")
        }
        val parser = registry.getParser(filePath)
            ?: return IndexResult(relativePath, 0, 0, 0, System.currentTimeMillis() - startTime, "regex-fallback")
        val result = parser.parse(source, relativePath)
        return IndexResult(
            filePath = relativePath,
            symbolCount = result.symbols.size,
            relationshipCount = result.relationships.size,
            parseErrors = result.errors.size,
            duration = System.currentTimeMillis() - startTime,
            method = "tree-sitter",
        )
    }

    fun indexFiles(files: List<Pair<String, String>>): List<IndexResult> =
        files.map { (abs, rel) -> indexFile(abs, rel) }
}
