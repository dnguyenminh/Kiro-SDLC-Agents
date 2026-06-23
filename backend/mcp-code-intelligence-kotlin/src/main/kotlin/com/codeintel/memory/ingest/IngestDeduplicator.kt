/** Deduplication logic — skips re-indexing files that haven't changed. */
package com.codeintel.memory.ingest

import com.codeintel.log
import java.nio.file.Path
import java.security.MessageDigest
import java.sql.Connection
import kotlin.io.path.exists
import kotlin.io.path.fileSize
import kotlin.io.path.getLastModifiedTime

/** Result of dedup check. */
data class DeduplicationResult(
    val needsReindex: Boolean,
    val reason: String
)

/** Checks file cache in DB to determine if re-indexing is needed. */
class IngestDeduplicator(private val connection: Connection) {

    init { ensureTable() }

    /** Check if file needs re-indexing. Fast path: mtime + size. Slow path: checksum. */
    fun check(filePath: Path): DeduplicationResult {
        if (!filePath.exists()) return DeduplicationResult(false, "file not found")

        val cached = loadCacheEntry(filePath.toString())
            ?: return DeduplicationResult(true, "new file — not in cache")

        val currentMtime = filePath.getLastModifiedTime().toMillis()
        val currentSize = filePath.fileSize()

        // Fast path: mtime + size unchanged → skip
        if (currentMtime == cached.mtimeMs && currentSize == cached.fileSize) {
            return DeduplicationResult(false, "unchanged (mtime+size match)")
        }

        // Slow path: content may have changed — verify with checksum
        val currentChecksum = computeChecksum(filePath)
        if (currentChecksum == cached.checksum) {
            // File was touched but content unchanged — update mtime in cache
            updateMtime(filePath.toString(), currentMtime)
            return DeduplicationResult(false, "unchanged (checksum match)")
        }

        return DeduplicationResult(true, "content changed (checksum mismatch)")
    }

    /** Record successful ingestion in cache. */
    fun recordIngested(filePath: Path, entryCount: Int) {
        if (!filePath.exists()) return
        val checksum = computeChecksum(filePath)
        val mtime = filePath.getLastModifiedTime().toMillis()
        val size = filePath.fileSize()

        val sql = """
            INSERT OR REPLACE INTO ingest_file_cache 
            (file_path, checksum, mtime_ms, file_size, entry_count, last_ingested_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
        """.trimIndent()

        connection.prepareStatement(sql).use { stmt ->
            stmt.setString(1, filePath.toString())
            stmt.setString(2, checksum)
            stmt.setLong(3, mtime)
            stmt.setLong(4, size)
            stmt.setInt(5, entryCount)
            stmt.executeUpdate()
        }
        log("IngestDeduplicator: cached $filePath (checksum=$checksum)")
    }

    /** Remove cache entry (e.g., when file is deleted). */
    fun invalidate(filePath: String) {
        val sql = "DELETE FROM ingest_file_cache WHERE file_path = ?"
        connection.prepareStatement(sql).use { stmt ->
            stmt.setString(1, filePath)
            stmt.executeUpdate()
        }
    }

    private fun loadCacheEntry(filePath: String): CacheEntry? {
        val sql = "SELECT checksum, mtime_ms, file_size FROM ingest_file_cache WHERE file_path = ?"
        connection.prepareStatement(sql).use { stmt ->
            stmt.setString(1, filePath)
            val rs = stmt.executeQuery()
            if (!rs.next()) return null
            return CacheEntry(
                checksum = rs.getString("checksum"),
                mtimeMs = rs.getLong("mtime_ms"),
                fileSize = rs.getLong("file_size")
            )
        }
    }

    private fun updateMtime(filePath: String, newMtime: Long) {
        val sql = "UPDATE ingest_file_cache SET mtime_ms = ? WHERE file_path = ?"
        connection.prepareStatement(sql).use { stmt ->
            stmt.setLong(1, newMtime)
            stmt.setString(2, filePath)
            stmt.executeUpdate()
        }
    }

    private fun ensureTable() {
        connection.createStatement().use { stmt ->
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS ingest_file_cache (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  file_path TEXT NOT NULL UNIQUE,
                  checksum TEXT NOT NULL,
                  mtime_ms INTEGER NOT NULL,
                  file_size INTEGER NOT NULL,
                  entry_count INTEGER NOT NULL DEFAULT 0,
                  last_ingested_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            """.trimIndent())
        }
    }

    private data class CacheEntry(val checksum: String, val mtimeMs: Long, val fileSize: Long)
}

/** Compute MD5 checksum of a file. */
fun computeChecksum(filePath: Path): String {
    val digest = MessageDigest.getInstance("MD5")
    filePath.toFile().inputStream().use { input ->
        val buffer = ByteArray(8192)
        var read: Int
        while (input.read(buffer).also { read = it } != -1) {
            digest.update(buffer, 0, read)
        }
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
}
