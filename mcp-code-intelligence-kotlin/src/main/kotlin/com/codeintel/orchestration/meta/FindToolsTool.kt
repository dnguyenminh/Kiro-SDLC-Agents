/**
 * find_tools meta-tool — fuzzy search across all registered tools (native + child)
 * by name and description. Returns matching tool definitions.
 */
package com.codeintel.orchestration.meta

import com.codeintel.orchestration.OrchestrationEngine
import kotlinx.serialization.json.*

class FindToolsTool(private val engine: OrchestrationEngine) {
    private val json = Json { encodeDefaults = true }

    /** Execute fuzzy search for tools matching query. */
    fun execute(args: JsonObject): String {
        val query = args["query"]?.jsonPrimitive?.content ?: return errorJson("Missing 'query'")
        val results = engine.getRegistry().search(query)
        val arr = buildJsonArray {
            for (tool in results) {
                add(tool.definition)
            }
        }
        return json.encodeToString(JsonArray.serializer(), arr)
    }

    /** Tool definition for tools/list registration. */
    fun definition(): JsonObject = buildJsonObject {
        put("name", "find_tools")
        put("description", "Search for available tools by describing what you want to accomplish. Returns tool definitions with input schemas.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("query") {
                    put("type", "string")
                    put("description", "Natural language description or keyword to search for")
                }
            }
            putJsonArray("required") { add("query") }
        }
    }

    private fun errorJson(msg: String) = """{"error":"$msg"}"""
}
