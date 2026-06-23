/** Indexing engine — full scan and incremental indexing. */
package com.codeintel.indexer

import com.codeintel.Config
import com.codeintel.db.DatabaseManager
import com.codeintel.log
import com.codeintel.scanner.*
import java.nio.file.Path
import kotlin.io.path.readText

class IndexingEngine(private val db: DatabaseManager, private val config: Config) {
    @Volatile var isRunning = false
        private set

    /** Run a full workspace index. */
    suspend fun runFullIndex() {
        if (isRunning) return
        isRunning = true
        log("Starting full index...")
        try {
            val files = scanWorkspace(config)
            log("Found ${files.size} files to index")
            indexFiles(files)
            updateModules()
            detectAndStorePatterns()
            log("Full index complete")
        } finally {
            isRunning = false
        }
    }

    /** Index a single file (incremental update). */
    fun indexSingleFile(filePath: String) {
        val info = scanSingleFile(filePath, config.workspace) ?: return
        if (isUnchanged(info)) return
        upsertFile(info)
    }

    /** Remove a file from the index. */
    fun removeFile(relativePath: String) {
        db.conn.prepareStatement("DELETE FROM files WHERE relative_path = ?").use {
            it.setString(1, relativePath)
            it.executeUpdate()
        }
    }

    private fun indexFiles(files: List<FileInfo>) {
        db.conn.autoCommit = false
        for (file in files) {
            if (isUnchanged(file)) continue
            upsertFile(file)
        }
        db.conn.commit()
        db.conn.autoCommit = true
    }

    private fun upsertFile(fileInfo: FileInfo) {
        val module = detectModule(fileInfo.relativePath)
        val stmt = db.conn.prepareStatement("""
            INSERT OR REPLACE INTO files
            (path, relative_path, language, module, content_hash, size_bytes, line_count, last_indexed)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        """.trimIndent())
        stmt.use {
            it.setString(1, fileInfo.absolutePath)
            it.setString(2, fileInfo.relativePath)
            it.setString(3, fileInfo.language)
            it.setString(4, module)
            it.setString(5, fileInfo.contentHash)
            it.setLong(6, fileInfo.sizeBytes)
            it.setInt(7, fileInfo.lineCount)
            it.executeUpdate()
        }
        val fileId = getFileId(fileInfo.relativePath) ?: return
        deleteSymbols(fileId)
        indexSymbols(fileInfo, fileId)
    }

    private fun indexSymbols(fileInfo: FileInfo, fileId: Long) {
        val content = try {
            Path.of(fileInfo.absolutePath).readText(Charsets.UTF_8)
        } catch (e: Exception) {
            log("Error reading ${fileInfo.relativePath}: ${e.message}")
            return
        }
        val symbols = extractSymbols(content, fileInfo.language)
        val stmt = db.conn.prepareStatement("""
            INSERT INTO symbols (file_id, name, kind, signature, start_line, end_line, parent_symbol, visibility, doc_comment)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """.trimIndent())
        stmt.use { s ->
            for (sym in symbols) {
                s.setLong(1, fileId); s.setString(2, sym.name)
                s.setString(3, sym.kind); s.setString(4, sym.signature)
                s.setInt(5, sym.startLine); s.setInt(6, sym.endLine)
                s.setString(7, sym.parentSymbol); s.setString(8, sym.visibility)
                s.setString(9, sym.docComment)
                s.executeUpdate()
            }
        }
    }

    private fun isUnchanged(fileInfo: FileInfo): Boolean {
        val stmt = db.conn.prepareStatement("SELECT content_hash FROM files WHERE relative_path = ?")
        stmt.use {
            it.setString(1, fileInfo.relativePath)
            val rs = it.executeQuery()
            if (!rs.next()) return false
            return rs.getString(1) == fileInfo.contentHash
        }
    }

    private fun getFileId(relativePath: String): Long? {
        val stmt = db.conn.prepareStatement("SELECT id FROM files WHERE relative_path = ?")
        stmt.use {
            it.setString(1, relativePath)
            val rs = it.executeQuery()
            return if (rs.next()) rs.getLong(1) else null
        }
    }

    private fun deleteSymbols(fileId: Long) {
        db.conn.prepareStatement("DELETE FROM symbols WHERE file_id = ?").use {
            it.setLong(1, fileId); it.executeUpdate()
        }
    }

    private fun updateModules() {
        db.conn.createStatement().use { it.executeUpdate("DELETE FROM modules") }
        val rows = db.conn.createStatement().executeQuery("""
            SELECT module, language, COUNT(*) as file_count,
                   (SELECT COUNT(*) FROM symbols WHERE file_id IN
                    (SELECT id FROM files WHERE module = f.module)) as symbol_count
            FROM files f WHERE module IS NOT NULL GROUP BY module
        """.trimIndent())
        val stmt = db.conn.prepareStatement(
            "INSERT INTO modules (name, root_path, language, file_count, symbol_count) VALUES (?, ?, ?, ?, ?)"
        )
        stmt.use { s ->
            while (rows.next()) {
                s.setString(1, rows.getString(1)); s.setString(2, rows.getString(1))
                s.setString(3, rows.getString(2)); s.setInt(4, rows.getInt(3))
                s.setInt(5, rows.getInt(4)); s.executeUpdate()
            }
        }
    }

    private fun detectAndStorePatterns() {
        val startMs = System.currentTimeMillis()
        val modules = mutableListOf<String>()
        db.conn.createStatement().executeQuery("SELECT name FROM modules").use { rs ->
            while (rs.next()) modules.add(rs.getString(1))
        }
        val updateStmt = db.conn.prepareStatement(
            "UPDATE modules SET di_style=?, error_handling=?, naming_convention=?, " +
            "logging_framework=?, testing_framework=?, purpose=? WHERE name=?"
        )
        updateStmt.use { stmt ->
            for (name in modules) {
                try {
                    val symbols = mutableListOf<Symbol>()
                    db.conn.prepareStatement(
                        "SELECT name, kind, signature, visibility FROM symbols " +
                        "WHERE file_id IN (SELECT id FROM files WHERE module = ?)"
                    ).use { q ->
                        q.setString(1, name)
                        val rs = q.executeQuery()
                        while (rs.next()) {
                            symbols.add(Symbol(
                                name = rs.getString(1), kind = rs.getString(2),
                                signature = rs.getString(3) ?: "", startLine = 0,
                                endLine = 0, parentSymbol = null,
                                visibility = rs.getString(4), docComment = null
                            ))
                        }
                    }
                    val classes = symbols.filter { it.kind in listOf("class", "interface") }
                    val functions = symbols.filter { it.kind in listOf("function", "method") }
                    val patterns = detectPatterns(classes, functions, emptyList())
                    val purpose = inferModulePurpose(name, classes, emptyList())
                    stmt.setString(1, patterns.diStyle)
                    stmt.setString(2, patterns.errorHandling)
                    stmt.setString(3, patterns.naming)
                    stmt.setString(4, patterns.logging)
                    stmt.setString(5, patterns.testing)
                    stmt.setString(6, purpose)
                    stmt.setString(7, name)
                    stmt.executeUpdate()
                } catch (e: Exception) {
                    log("Pattern detection failed for $name: ${e.message}")
                }
            }
        }
        log("Pattern detection: ${System.currentTimeMillis() - startMs}ms")
    }
}

private fun detectModule(relativePath: String): String {
    val parts = relativePath.split("/")
    // SFDX project structure: force-app/main/default/{type}/{name}
    if (parts.size >= 4 && parts[0] == "force-app") {
        val sfType = parts.getOrNull(3) ?: return "force-app"
        return "sf:$sfType"
    }
    // Alternative SFDX: src/{type}/{name}
    if (parts.size >= 3 && parts[0] == "src" &&
        parts[1] in SFDX_METADATA_TYPES) {
        return "sf:${parts[1]}"
    }
    if (parts.size >= 2 && parts[0] == "src") return parts[1]
    return parts.firstOrNull() ?: "root"
}

private val SFDX_METADATA_TYPES = setOf(
    "classes", "triggers", "lwc", "aura", "flows",
    "objects", "pages", "components", "staticresources",
)
