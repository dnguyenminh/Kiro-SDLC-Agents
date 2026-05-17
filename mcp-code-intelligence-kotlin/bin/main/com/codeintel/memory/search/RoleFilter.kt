/** Role-aware type filter — each agent role sees relevant knowledge types. */
package com.codeintel.memory.search

object RoleFilter {
    private val ROLE_TYPES = mapOf(
        "DEV" to setOf("CODE_ENTITY", "ARCHITECTURE", "API_DESIGN", "DECISION"),
        "BA" to setOf("REQUIREMENT", "CONTEXT", "DECISION", "LESSON_LEARNED"),
        "QA" to setOf("PROCEDURE", "REQUIREMENT", "ERROR_PATTERN", "LESSON_LEARNED"),
        "SA" to setOf("ARCHITECTURE", "API_DESIGN", "CODE_ENTITY", "DECISION"),
        "DEVOPS" to setOf("PROCEDURE", "ARCHITECTURE", "CONTEXT")
    )

    /** Get allowed types for a role. Returns null if no filter (all types). */
    fun typesForRole(role: String?): Set<String>? {
        if (role.isNullOrBlank()) return null
        return ROLE_TYPES[role.uppercase()]
    }
}
