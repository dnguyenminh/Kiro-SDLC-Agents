/** KSA-74: Content Quality Scoring & Validation. */
package com.codeintel.memory.tools.v2

import kotlinx.serialization.json.*
import java.sql.Connection
import java.time.Instant
import java.time.temporal.ChronoUnit

class KbQualityTool(private val conn: Connection) {

    fun execute(args: JsonObject): String {
        return when (args.str("action") ?: "stats") {
            "score" -> scoreEntry(args)
            "score_all" -> scoreAll(args)
            "low_quality" -> getLowQuality(args)
            "validate" -> validateContent(args)
            else -> getStats()
        }
    }

    private fun scoreEntry(args: JsonObject): String {
        val entryId = args.int("entry_id") ?: return """{"error":"entry_id required"}"""
        val rs = conn.prepareStatement("SELECT * FROM knowledge_entries WHERE id = ?").use { it.setInt(1, entryId); it.executeQuery() }
        if (!rs.next()) return """{"error":"entry not found"}"""
        val content = rs.getString("content") ?: ""
        val tags = rs.getString("tags") ?: ""
        val source = rs.getString("source")
        val owner = rs.getString("owner")
        val updatedAt = rs.getString("updated_at")
        val accessCount = rs.getInt("access_count")

        val lenScore = scoreLength(content)
        val structScore = scoreStructure(content)
        val metaScore = scoreMetadata(tags, source, owner)
        val freshScore = scoreFreshness(updatedAt)
        val engScore = scoreEngagement(accessCount)
        val total = (lenScore * 0.2 + structScore * 0.2 + metaScore * 0.2 + freshScore * 0.2 + engScore * 0.2).toInt()

        conn.prepareStatement("INSERT OR REPLACE INTO quality_scores (entry_id, total_score, dimensions) VALUES (?, ?, ?)").use { it.setInt(1, entryId); it.setDouble(2, total.toDouble()); it.setString(3, """{"length":$lenScore,"structure":$structScore,"metadata":$metaScore,"freshness":$freshScore,"engagement":$engScore}"""); it.executeUpdate() }
        return """{"entry_id":$entryId,"total_score":$total,"dimensions":{"length":$lenScore,"structure":$structScore,"metadata":$metaScore,"freshness":$freshScore,"engagement":$engScore}}"""
    }

    private fun scoreAll(args: JsonObject): String {
        val limit = args.int("limit") ?: 100
        val rs = conn.prepareStatement("SELECT id FROM knowledge_entries WHERE archived_at IS NULL LIMIT ?").use { it.setInt(1, limit); it.executeQuery() }
        var count = 0
        while (rs.next()) { scoreEntry(buildJsonObject { put("entry_id", rs.getInt(1)) }); count++ }
        return """{"scored":$count}"""
    }

    private fun getLowQuality(args: JsonObject): String {
        val threshold = args.int("threshold") ?: 40
        val limit = args.int("limit") ?: 20
        val rs = conn.prepareStatement("SELECT qs.entry_id, qs.total_score, ke.summary FROM quality_scores qs JOIN knowledge_entries ke ON qs.entry_id = ke.id WHERE qs.total_score < ? ORDER BY qs.total_score ASC LIMIT ?").use { it.setInt(1, threshold); it.setInt(2, limit); it.executeQuery() }
        val items = mutableListOf<String>()
        while (rs.next()) items.add("""{"entry_id":${rs.getInt("entry_id")},"score":${rs.getDouble("total_score")},"summary":"${rs.getString("summary")?.take(60)?.replace("\"", "'")}"}""")
        return "[${items.joinToString(",")}]"
    }

    private fun validateContent(args: JsonObject): String {
        val content = args.str("content") ?: return """{"error":"content required"}"""
        val issues = mutableListOf<String>()
        if (content.length < 50) issues.add("Content too short")
        if (!content.contains("\n")) issues.add("No structure")
        if (content.split("\\s+".toRegex()).size < 10) issues.add("Too few words")
        return """{"valid":${issues.isEmpty()},"issues":${issues.map { "\"$it\"" }},"char_count":${content.length}}"""
    }

    private fun getStats(): String {
        val total = conn.prepareStatement("SELECT COUNT(*) FROM quality_scores").use { val rs = it.executeQuery(); rs.next(); rs.getInt(1) }
        val avg = conn.prepareStatement("SELECT AVG(total_score) FROM quality_scores").use { val rs = it.executeQuery(); rs.next(); rs.getDouble(1) }
        val low = conn.prepareStatement("SELECT COUNT(*) FROM quality_scores WHERE total_score < 40").use { val rs = it.executeQuery(); rs.next(); rs.getInt(1) }
        return """{"total_scored":$total,"avg_score":${"%.1f".format(avg)},"low_quality_count":$low}"""
    }

    private fun scoreLength(content: String): Int = when {
        content.length < 50 -> 20; content.length < 200 -> 50; content.length < 500 -> 75; else -> 100
    }

    private fun scoreStructure(content: String): Int {
        var s = 40
        if (content.contains("\n")) s += 20
        if (content.contains("##") || content.contains("**")) s += 20
        if (content.contains("- ") || content.contains("1.")) s += 20
        return s.coerceAtMost(100)
    }

    private fun scoreMetadata(tags: String, source: String?, owner: String?): Int {
        var s = 0
        if (tags.isNotBlank()) s += 30
        if (!source.isNullOrBlank()) s += 30
        if (!owner.isNullOrBlank()) s += 40
        return s.coerceAtMost(100)
    }

    private fun scoreFreshness(updatedAt: String?): Int {
        if (updatedAt == null) return 30
        val days = try { ChronoUnit.DAYS.between(Instant.parse(updatedAt), Instant.now()) } catch (_: Exception) { 180L }
        return when { days < 7 -> 100; days < 30 -> 80; days < 90 -> 60; days < 180 -> 40; else -> 20 }
    }

    private fun scoreEngagement(accessCount: Int): Int = when {
        accessCount >= 20 -> 100; accessCount >= 10 -> 80; accessCount >= 5 -> 60; accessCount >= 1 -> 40; else -> 20
    }
}
