/**
 * StructuredMapExtractor — rule-based extraction of metadata from content.
 * No LLM dependency: uses regex patterns and keyword scoring.
 * Port of Node.js structured-map-extractor.ts (KSA-142 F3).
 */
package com.codeintel.memory.map

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.sql.Connection

@Serializable
data class StructuredMap(
    val topic: String = "",
    val entitiesMentioned: List<String> = emptyList(),
    val decisionsMade: List<String> = emptyList(),
    val actionItems: List<String> = emptyList(),
    val contextRefs: List<String> = emptyList(),
    val sentiment: String = "neutral"
) {
    fun toJson(): String = json.encodeToString(this)

    companion object {
        private val json = Json { encodeDefaults = true; ignoreUnknownKeys = true }
        fun empty() = StructuredMap()
        fun fromJson(s: String): StructuredMap = try {
            json.decodeFromString<StructuredMap>(s)
        } catch (_: Exception) { empty() }
    }
}

class StructuredMapExtractor(private val db: Connection) {

    /** Extract structured map from text content. */
    fun extract(content: String): StructuredMap {
        if (content.isBlank()) return StructuredMap.empty()
        return StructuredMap(
            topic = extractTopic(content),
            entitiesMentioned = extractEntities(content),
            decisionsMade = extractDecisions(content),
            actionItems = extractActionItems(content),
            contextRefs = extractContextRefs(content),
            sentiment = analyzeSentiment(content)
        )
    }

    /** Re-extract structured map for an existing entry and update DB. */
    fun reExtract(entryId: Int): StructuredMap {
        val ps = db.prepareStatement("SELECT content FROM knowledge_entries WHERE id = ?")
        ps.setInt(1, entryId)
        val rs = ps.executeQuery()
        val content = if (rs.next()) rs.getString("content") ?: "" else ""
        rs.close(); ps.close()
        val map = extract(content)
        db.prepareStatement("UPDATE knowledge_entries SET structured_map = ? WHERE id = ?").use {
            it.setString(1, map.toJson()); it.setInt(2, entryId); it.executeUpdate()
        }
        return map
    }
}

private fun extractTopic(content: String): String {
    val match = Regex("^#+\\s+(.+)$", RegexOption.MULTILINE).find(content)
    if (match != null) return match.groupValues[1].trim().take(120)
    val firstLine = content.split("\n").firstOrNull { it.isNotBlank() } ?: ""
    return firstLine.trim().take(120)
}

private fun extractEntities(content: String): List<String> {
    val entities = mutableSetOf<String>()
    val patterns = listOf(
        Regex("[A-Z][A-Z0-9]+-\\d+"),                    // Ticket IDs
        Regex("@[\\w-]+"),                                // @mentions
        Regex("(?:^|\\s)((?:[A-Z][a-z0-9]+){2,})", RegexOption.MULTILINE) // PascalCase
    )
    for (pat in patterns) {
        for (match in pat.findAll(content)) {
            entities.add(match.value.trim())
        }
    }
    return entities.take(20).toList()
}

private fun extractDecisions(content: String): List<String> {
    val prefixes = listOf("decision:", "decided:", "we will", "chosen approach", "agreed:")
    return content.split("\n")
        .filter { line -> prefixes.any { line.lowercase().trim().startsWith(it) } }
        .map { it.trim().take(200) }
        .take(10)
}

private fun extractActionItems(content: String): List<String> {
    val patterns = listOf(
        Regex("TODO", RegexOption.IGNORE_CASE),
        Regex("action:", RegexOption.IGNORE_CASE),
        Regex("next step:", RegexOption.IGNORE_CASE),
        Regex("\\[ ]")
    )
    return content.split("\n")
        .filter { line -> patterns.any { it.containsMatchIn(line) } }
        .map { it.trim().take(200) }
        .take(10)
}

private fun extractContextRefs(content: String): List<String> {
    val refs = mutableSetOf<String>()
    val patterns = listOf(
        Regex("https?://[^\\s)]+"),
        Regex("[A-Z][A-Z0-9]+-\\d+"),
        Regex("(?:[\\w-]+/)+[\\w-]+\\.\\w+")
    )
    for (pat in patterns) {
        for (match in pat.findAll(content)) refs.add(match.value)
    }
    return refs.take(20).toList()
}

private fun analyzeSentiment(content: String): String {
    val lower = content.lowercase()
    val posWords = listOf("success", "resolved", "fixed", "improved", "great", "works", "done", "complete")
    val negWords = listOf("error", "fail", "bug", "broken", "issue", "problem", "crash", "blocked")
    val posScore = posWords.count { it in lower }
    val negScore = negWords.count { it in lower }
    return when {
        posScore > 0 && negScore > 0 -> "mixed"
        posScore > negScore -> "positive"
        negScore > posScore -> "negative"
        else -> "neutral"
    }
}
