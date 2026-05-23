/**
 * QualityGate — validates content before ingest to prevent KB pollution.
 * Checks: minimum length, duplicate detection (trigram Jaccard), quality scoring.
 * Rejects entries with score < 30, warns for score 30-50.
 */
package com.codeintel.memory.search

import java.sql.Connection

/** Result of quality validation. */
data class QualityResult(
    val score: Int,
    val decision: String, // "accept", "warn", "reject"
    val message: String?,
    val duplicateDetected: Boolean,
    val duplicateEntryId: Long?
)

/** Metadata provided during ingest for quality scoring. */
data class IngestMeta(
    val tags: String? = null,
    val type: String? = null,
    val source: String? = null
)

class QualityGate(
    private val conn: Connection,
    private val minLength: Int = 50,
    private val rejectThreshold: Int = 30,
    private val warnThreshold: Int = 50,
    private val duplicateThreshold: Double = 0.95
) {

    /** Validate content before ingest. Returns quality decision. */
    fun validate(content: String, meta: IngestMeta): QualityResult {
        val trimmed = content.trim()
        if (trimmed.length < minLength) {
            return QualityResult(
                score = 0, decision = "reject",
                message = "Content too short (min $minLength chars). Got ${trimmed.length}.",
                duplicateDetected = false, duplicateEntryId = null
            )
        }

        val dup = checkDuplicate(trimmed)
        if (dup.first >= duplicateThreshold) {
            return QualityResult(
                score = 10, decision = "reject",
                message = "Duplicate detected (similarity: ${"%.1f".format(dup.first * 100)}%). Existing entry ID: ${dup.second}",
                duplicateDetected = true, duplicateEntryId = dup.second
            )
        }

        val score = calculateScore(trimmed, meta)
        val decision = decideFromScore(score)
        val message = if (decision == "warn")
            "Low quality score ($score/100). Consider adding tags, source, or more detail."
        else null

        return QualityResult(score, decision, message, false, null)
    }

    private fun calculateScore(content: String, meta: IngestMeta): Int {
        var score = 0
        score += minOf(40, (content.length * 40) / 500)
        if (!meta.tags.isNullOrBlank()) score += 20
        if (!meta.type.isNullOrBlank()) score += 10
        if (!meta.source.isNullOrBlank()) score += 10
        if (hasStructure(content)) score += 10
        if (hasActionableContent(content)) score += 10
        return minOf(100, score)
    }

    private fun checkDuplicate(content: String): Pair<Double, Long?> {
        val trigrams = buildTrigrams(content.lowercase().take(200))
        if (trigrams.isEmpty()) return 0.0 to null

        val candidates = loadRecentEntries()
        var maxSim = 0.0
        var matchId: Long? = null

        for ((id, candidateContent) in candidates) {
            val candidateTrigrams = buildTrigrams(candidateContent.lowercase().take(200))
            val sim = jaccardSimilarity(trigrams, candidateTrigrams)
            if (sim > maxSim) { maxSim = sim; matchId = id }
        }
        return maxSim to matchId
    }

    private fun loadRecentEntries(): List<Pair<Long, String>> {
        val results = mutableListOf<Pair<Long, String>>()
        conn.prepareStatement(
            "SELECT id, content FROM knowledge_entries WHERE archived = 0 ORDER BY created_at DESC LIMIT 50"
        ).use { stmt ->
            stmt.executeQuery().use { rs ->
                while (rs.next()) results.add(rs.getLong("id") to rs.getString("content"))
            }
        }
        return results
    }

    private fun decideFromScore(score: Int): String = when {
        score < rejectThreshold -> "reject"
        score < warnThreshold -> "warn"
        else -> "accept"
    }
}

private fun hasStructure(text: String): Boolean =
    Regex("^#{1,6}\\s", RegexOption.MULTILINE).containsMatchIn(text) ||
        Regex("^[-*]\\s", RegexOption.MULTILINE).containsMatchIn(text) ||
        "```" in text

private fun hasActionableContent(text: String): Boolean =
    Regex("\\b(TODO|Action:|Decision:|Next step:|Decided:)", RegexOption.IGNORE_CASE)
        .containsMatchIn(text) || Regex("\\[[ x]]", RegexOption.IGNORE_CASE).containsMatchIn(text)

private fun buildTrigrams(text: String): Set<String> {
    val set = mutableSetOf<String>()
    for (i in 0..text.length - 3) set.add(text.substring(i, i + 3))
    return set
}

private fun jaccardSimilarity(a: Set<String>, b: Set<String>): Double {
    if (a.isEmpty() && b.isEmpty()) return 1.0
    val intersection = a.count { it in b }
    val union = a.size + b.size - intersection
    return if (union == 0) 0.0 else intersection.toDouble() / union
}
