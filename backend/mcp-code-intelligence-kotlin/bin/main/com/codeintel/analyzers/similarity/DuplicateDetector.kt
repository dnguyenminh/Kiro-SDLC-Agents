/** Main duplicate detection using embedding similarity. */
package com.codeintel.analyzers.similarity

import com.codeintel.analyzers.similarity.models.DuplicateReport
import com.codeintel.analyzers.similarity.models.SimilarityPair
import com.codeintel.analyzers.similarity.models.SymbolInfo
import com.codeintel.log
import java.sql.Connection

/**
 * Find near-duplicate code using embedding similarity.
 * Uses body embeddings from the index DB to compute cosine similarity
 * between all function pairs, then clusters them using Union-Find.
 */
class DuplicateDetector(
    private val conn: Connection,
    private val minSimilarity: Double = 0.85,
    private val minLines: Int = 5
) {
    private val suggestionGen = SuggestionGenerator()

    /** Find duplicate functions. */
    fun detect(filePath: String? = null): DuplicateReport {
        val embeddings = loadEmbeddings(filePath)
        log("Loaded ${embeddings.size} function embeddings")

        if (embeddings.size < 2) {
            return DuplicateReport(embeddings.size, emptyList(), emptyList(), emptyList())
        }

        val pairs = computeSimilarities(embeddings)
        log("Found ${pairs.size} similar pairs (threshold=$minSimilarity)")

        val clusterBuilder = ClusterBuilder()
        for (pair in pairs) clusterBuilder.union(pair.a, pair.b)
        val clusters = clusterBuilder.getClusters()

        val symbolInfo = getSymbolInfo(embeddings.keys)
        val suggestions = suggestionGen.generate(clusters, symbolInfo)

        return DuplicateReport(embeddings.size, pairs, clusters, suggestions)
    }

    private fun loadEmbeddings(filePath: String?): Map<String, FloatArray> {
        val sql = buildString {
            append("""
                SELECT s.name, f.relative_path, s.start_line, s.end_line, e.vector
                FROM embeddings e
                JOIN symbols s ON e.symbol_id = s.id
                JOIN files f ON s.file_id = f.id
                WHERE s.kind IN ('function', 'method')
                  AND (s.end_line - s.start_line) >= ?
            """.trimIndent())
            if (filePath != null) append(" AND f.relative_path = ?")
        }
        return executeEmbeddingQuery(sql, filePath)
    }

    private fun executeEmbeddingQuery(sql: String, filePath: String?): Map<String, FloatArray> {
        val result = mutableMapOf<String, FloatArray>()
        conn.prepareStatement(sql).use { stmt ->
            stmt.setInt(1, minLines)
            if (filePath != null) stmt.setString(2, filePath)
            stmt.executeQuery().use { rs ->
                while (rs.next()) {
                    val key = "${rs.getString("relative_path")}:${rs.getString("name")}"
                    val blob = rs.getBytes("vector")
                    if (blob != null) result[key] = bytesToFloats(blob)
                }
            }
        }
        return result
    }

    private fun computeSimilarities(embeddings: Map<String, FloatArray>): List<SimilarityPair> {
        val keys = embeddings.keys.toList()
        val pairs = mutableListOf<SimilarityPair>()
        for (i in keys.indices) {
            val vecA = embeddings[keys[i]]!!
            for (j in i + 1 until keys.size) {
                val sim = cosineSimilarity(vecA, embeddings[keys[j]]!!)
                if (sim >= minSimilarity) {
                    pairs.add(SimilarityPair(keys[i], keys[j], sim))
                }
            }
        }
        return pairs
    }

    private fun getSymbolInfo(keys: Set<String>): Map<String, SymbolInfo> {
        val info = mutableMapOf<String, SymbolInfo>()
        for (key in keys) {
            val parts = key.split(":", limit = 2)
            if (parts.size != 2) continue
            val (file, name) = parts
            querySymbolInfo(file, name)?.let { info[key] = it }
        }
        return info
    }

    private fun querySymbolInfo(file: String, name: String): SymbolInfo? {
        val sql = """
            SELECT s.kind, s.start_line, s.end_line, s.visibility
            FROM symbols s JOIN files f ON s.file_id = f.id
            WHERE f.relative_path = ? AND s.name = ? LIMIT 1
        """.trimIndent()
        conn.prepareStatement(sql).use { stmt ->
            stmt.setString(1, file)
            stmt.setString(2, name)
            stmt.executeQuery().use { rs ->
                if (!rs.next()) return null
                return SymbolInfo(file, name, rs.getString(1), rs.getInt(2), rs.getInt(3), rs.getString(4))
            }
        }
    }
}
