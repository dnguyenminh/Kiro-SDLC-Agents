/**
 * AgentScopeFilter — tag-based KB isolation per agent role.
 * Each agent role has a configurable tag set. Search results are
 * filtered to only include entries matching the agent's tags.
 * Untagged entries remain visible to all agents (backward compatible).
 */
package com.codeintel.memory.search

import com.codeintel.memory.models.KnowledgeSearchResult
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import java.sql.Connection

/** Scope configuration for an agent role. */
data class AgentScope(val role: String, val tags: List<String>)

class AgentScopeFilter(private val conn: Connection) {

    private val cache = mutableMapOf<String, List<String>>()
    private val json = Json { ignoreUnknownKeys = true }

    init { loadCache() }

    /** Get scope configuration for an agent role. */
    fun getScope(agentRole: String): AgentScope? {
        val tags = cache[agentRole.uppercase()] ?: return null
        return AgentScope(agentRole.uppercase(), tags)
    }

    /** Filter search results by agent's tag set. */
    fun filter(results: List<KnowledgeSearchResult>, agentRole: String): List<KnowledgeSearchResult> {
        val scope = getScope(agentRole) ?: return results
        return results.filter { r ->
            val entryTags = parseTags(r.entry.tags)
            entryTags.isEmpty() || entryTags.any { it in scope.tags }
        }
    }

    /** Update scope configuration for a role. */
    fun updateScope(agentRole: String, tags: List<String>) {
        val role = agentRole.uppercase()
        val tagJson = "[" + tags.joinToString(",") { "\"$it\"" } + "]"
        conn.prepareStatement("""
            INSERT INTO agent_scope_config (agent_role, tag_set, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(agent_role) DO UPDATE SET
              tag_set = excluded.tag_set, updated_at = datetime('now')
        """.trimIndent()).use { stmt ->
            stmt.setString(1, role)
            stmt.setString(2, tagJson)
            stmt.executeUpdate()
        }
        cache[role] = tags
    }

    private fun loadCache() {
        cache.clear()
        try {
            conn.createStatement().use { stmt ->
                stmt.executeQuery("SELECT agent_role, tag_set FROM agent_scope_config").use { rs ->
                    while (rs.next()) {
                        val role = rs.getString("agent_role")
                        val tagSet = rs.getString("tag_set")
                        val parsed = json.parseToJsonElement(tagSet).jsonArray
                        val tags = parsed.map { it.jsonPrimitive.content }
                        cache[role] = tags
                    }
                }
            }
        } catch (_: Exception) {
            // Table may not exist yet (pre-migration)
        }
    }
}

/** Parse comma-separated tags string into list. */
private fun parseTags(tags: String?): List<String> {
    if (tags.isNullOrBlank()) return emptyList()
    return tags.split(",").map { it.trim().lowercase() }.filter { it.isNotEmpty() }
}
