/** MCP tool definitions for similarity analysis tools. */
package com.codeintel.analyzers.similarity

import kotlinx.serialization.json.*

/** Tool definitions for find_duplicates, find_dead_code, and git_search. */
object SimilarityToolDefinitions {

    val ALL: List<JsonObject> by lazy { listOf(findDuplicates(), findDeadCode(), gitSearch()) }

    private fun findDuplicates() = buildJsonObject {
        put("name", "find_duplicates")
        put("description", "Find near-duplicate functions using embedding similarity.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("file") { put("type", "string"); put("description", "File path to scan (optional)") }
                putJsonObject("min_similarity") { put("type", "number"); put("description", "Cosine similarity threshold (default 0.85)") }
                putJsonObject("min_lines") { put("type", "number"); put("description", "Min function lines (default 5)") }
            }
        }
    }

    private fun findDeadCode() = buildJsonObject {
        put("name", "find_dead_code")
        put("description", "Detect potentially dead/unreachable code using call graph reachability.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("file") { put("type", "string"); put("description", "File path to scan (optional)") }
                putJsonObject("min_confidence") { put("type", "number"); put("description", "Confidence threshold 0-100 (default 60)") }
            }
        }
    }

    private fun gitSearch() = buildJsonObject {
        put("name", "git_search")
        put("description", "Semantic search over git commit history. Find commits by natural language query with optional filters.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("query") { put("type", "string"); put("description", "Natural language search query") }
                putJsonObject("limit") { put("type", "number"); put("description", "Max results (default 10)") }
                putJsonObject("author") { put("type", "string"); put("description", "Filter by author name/email") }
                putJsonObject("since") { put("type", "string"); put("description", "Filter commits since date (ISO format)") }
                putJsonObject("file_filter") { put("type", "string"); put("description", "Filter by file path pattern") }
            }
            putJsonArray("required") { add("query") }
        }
    }
}
