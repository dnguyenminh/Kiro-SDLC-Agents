package com.fec.memory.tools

import kotlinx.serialization.json.*

/**
 * Registry of all MCP tools with their schemas.
 */
object ToolRegistry {

    fun getToolDefinitions(): JsonArray = buildJsonArray {
        addTool("memory_ingest", "Store document/observation into memory", ingestSchema())
        addTool("memory_observe", "Record agent observation or event", observeSchema())
        addTool("memory_recall", "Hybrid search across memory tiers", recallSchema())
        addTool("memory_decide", "Record or retrieve decisions", decideSchema())
        addTool("memory_error", "Record error pattern for learning", errorSchema())
        addTool("memory_handoff", "Transfer context between agents", handoffSchema())
        addTool("memory_consolidate", "Trigger memory tier consolidation", consolidateSchema())
        addTool("memory_stats", "Get memory system statistics", statsSchema())
        addTool("memory_graph", "Query knowledge graph relations", graphSchema())
    }

    private fun JsonArrayBuilder.addTool(name: String, desc: String, schema: JsonObject) {
        addJsonObject {
            put("name", name)
            put("description", desc)
            put("inputSchema", schema)
        }
    }

    private fun ingestSchema() = buildJsonObject {
        put("type", "object")
        putJsonObject("properties") {
            prop("title", "string", "Memory title")
            prop("content", "string", "Content to store")
            prop("category", "string", "Category: requirement, design, decision, code, test, deploy")
            prop("ticket_key", "string", "Jira ticket key")
            prop("agent", "string", "Agent name: BA, SA, QA, DEV, DevOps")
            prop("importance", "number", "Importance 0.0-1.0 (default 0.5)")
            prop("tags", "string", "Comma-separated tags")
        }
        putJsonArray("required") { add("title"); add("content"); add("category") }
    }

    private fun observeSchema() = buildJsonObject {
        put("type", "object")
        putJsonObject("properties") {
            prop("observation", "string", "What was observed")
            prop("context", "string", "Context of observation")
            prop("agent", "string", "Observing agent")
            prop("ticket_key", "string", "Related ticket")
        }
        putJsonArray("required") { add("observation") }
    }

    private fun recallSchema() = buildJsonObject {
        put("type", "object")
        putJsonObject("properties") {
            prop("query", "string", "Search query")
            prop("ticket_key", "string", "Filter by ticket")
            prop("agent", "string", "Filter by agent")
            prop("category", "string", "Filter by category")
            prop("limit", "number", "Max results (default 10)")
        }
        putJsonArray("required") { add("query") }
    }

    private fun decideSchema() = buildJsonObject {
        put("type", "object")
        putJsonObject("properties") {
            prop("decision_type", "string", "Type: architecture, library, pattern, process")
            prop("context", "string", "Decision context")
            prop("chosen", "string", "Chosen option")
            prop("alternatives", "string", "JSON array of alternatives")
            prop("rationale", "string", "Why this was chosen")
            prop("ticket_key", "string", "Related ticket")
        }
        putJsonArray("required") { add("decision_type"); add("context"); add("chosen") }
    }

    private fun errorSchema() = buildJsonObject {
        put("type", "object")
        putJsonObject("properties") {
            prop("error_type", "string", "Type: build, runtime, test, deploy, config")
            prop("pattern", "string", "Error pattern/message")
            prop("resolution", "string", "How it was resolved")
            prop("ticket_key", "string", "Related ticket")
        }
        putJsonArray("required") { add("error_type"); add("pattern") }
    }

    private fun handoffSchema() = buildJsonObject {
        put("type", "object")
        putJsonObject("properties") {
            prop("ticket_key", "string", "Ticket being handed off")
            prop("from_agent", "string", "Source agent")
            prop("to_agent", "string", "Target agent")
            prop("phase", "string", "SDLC phase")
            prop("context_summary", "string", "Summary for receiving agent")
            prop("key_decisions", "string", "JSON array of key decisions")
            prop("open_issues", "string", "JSON array of open issues")
        }
        putJsonArray("required") { add("ticket_key"); add("from_agent"); add("to_agent"); add("context_summary") }
    }

    private fun consolidateSchema() = buildJsonObject {
        put("type", "object")
        putJsonObject("properties") {
            prop("tier", "string", "Target tier: episodic, semantic, procedural")
            prop("ticket_key", "string", "Consolidate for specific ticket")
        }
    }

    private fun statsSchema() = buildJsonObject {
        put("type", "object")
        putJsonObject("properties") {
            prop("ticket_key", "string", "Filter stats by ticket")
        }
    }

    private fun graphSchema() = buildJsonObject {
        put("type", "object")
        putJsonObject("properties") {
            prop("memory_id", "number", "Get relations for memory ID")
            prop("query", "string", "Search graph by text")
            prop("depth", "number", "Traversal depth (default 2)")
        }
    }

    private fun JsonObjectBuilder.prop(name: String, type: String, desc: String) {
        putJsonObject(name) { put("type", type); put("description", desc) }
    }
}
