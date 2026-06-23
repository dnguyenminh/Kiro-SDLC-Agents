/**
 * KSA-163: Dead Import Detector — Finds unused imports.
 */
package com.codeintel.analyzers.graphanalysis

import java.sql.Connection

class DeadImportDetector(private val conn: Connection) {

    fun detect(filePath: String? = null, module: String? = null, limit: Int = 50): List<DeadImport> {
        val sql = buildString {
            append("""
                SELECT r.file_path, r.line, r.target_symbol as importedSymbol, r.metadata
                FROM relationships r
                WHERE r.kind = 'imports'
                  AND NOT EXISTS (
                    SELECT 1 FROM relationships r2
                    WHERE r2.file_path = r.file_path
                      AND r2.kind IN ('calls', 'uses')
                      AND r2.target_symbol = r.target_symbol
                      AND r2.id != r.id
                  )
            """.trimIndent())
            filePath?.let { append(" AND r.file_path LIKE ?") }
            module?.let { append(" AND r.file_path LIKE ?") }
            append(" ORDER BY r.file_path, r.line LIMIT ?")
        }
        val results = mutableListOf<DeadImport>()
        conn.prepareStatement(sql).use { stmt ->
            var idx = 1
            filePath?.let { stmt.setString(idx++, "%$it%") }
            module?.let { stmt.setString(idx++, "%$it%") }
            stmt.setInt(idx, limit)
            val rs = stmt.executeQuery()
            while (rs.next()) {
                val fromModule = parseFromModule(rs.getString("metadata"))
                results.add(DeadImport(
                    filePath = rs.getString("file_path"),
                    line = rs.getInt("line"),
                    importedSymbol = rs.getString("importedSymbol"),
                    fromModule = fromModule,
                ))
            }
        }
        return results
    }

    private fun parseFromModule(metadata: String?): String {
        if (metadata == null) return ""
        return try {
            val match = Regex("\"(?:source|from)\"\\s*:\\s*\"([^\"]+)\"").find(metadata)
            match?.groupValues?.get(1) ?: ""
        } catch (_: Exception) { "" }
    }
}
