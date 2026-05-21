/** DSL helper for building MCP tool JSON schema definitions concisely. */
package com.codeintel.memory.tools

import kotlinx.serialization.json.*

object ToolSchemaDsl {
    val properties = mutableMapOf<String, JsonObject>()

    fun prop(name: String, type: String, desc: String) {
        properties[name] = buildJsonObject {
            put("type", type); put("description", desc)
        }
    }

    fun build(
        name: String,
        description: String,
        required: List<String> = emptyList(),
        block: ToolSchemaDsl.() -> Unit = {}
    ): JsonObject {
        properties.clear()
        block()
        val props = properties.toMap()
        return buildJsonObject {
            put("name", name)
            put("description", description)
            putJsonObject("inputSchema") {
                put("type", "object")
                putJsonObject("properties") {
                    props.forEach { (k, v) -> put(k, v) }
                }
                if (required.isNotEmpty()) {
                    putJsonArray("required") { required.forEach { add(it) } }
                }
            }
        }
    }
}
