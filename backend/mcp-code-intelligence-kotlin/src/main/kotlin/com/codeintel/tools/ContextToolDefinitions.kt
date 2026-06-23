/** MCP tool definitions for context tools — get_ai_context, get_edit_context, get_curated_context. KSA-171. */
package com.codeintel.tools

import kotlinx.serialization.json.*

object ContextToolDefinitions {
    val ALL: List<JsonObject> by lazy {
        listOf(getAIContext(), getEditContext(), getCuratedContext())
    }

    private fun getAIContext() = buildJsonObject {
        put("name", "get_ai_context")
        put("description", "Get intent-aware code context with token budgeting. Returns source, callers, callees, tests based on intent (explain/modify/debug/test).")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("symbol") { put("type", "string"); put("description", "Symbol name to get context for (supports Class.method, file:symbol formats)") }
                putJsonObject("intent") { put("type", "string"); put("description", "Intent: explain, modify, debug, test (default: explain)") }
                putJsonObject("token_budget") { put("type", "number"); put("description", "Max tokens for response (default: 4000, min: 500)") }
                putJsonObject("caller_depth") { put("type", "number"); put("description", "Depth for caller/callee traversal (default: 1, max: 5)") }
            }
            putJsonArray("required") { add("symbol") }
        }
    }

    private fun getEditContext() = buildJsonObject {
        put("name", "get_edit_context")
        put("description", "Get everything needed before editing a symbol: source + callers + tests + git history + siblings. Optimized for code modification.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("symbol") { put("type", "string"); put("description", "Symbol name or file:line format") }
                putJsonObject("include_callers") { put("type", "boolean"); put("description", "Include caller context (default: true)") }
                putJsonObject("include_tests") { put("type", "boolean"); put("description", "Include related test context (default: true)") }
                putJsonObject("include_git") { put("type", "boolean"); put("description", "Include git history (default: true)") }
                putJsonObject("token_budget") { put("type", "number"); put("description", "Max tokens (default: 4000)") }
                putJsonObject("caller_depth") { put("type", "number"); put("description", "Caller traversal depth (default: 1)") }
            }
            putJsonArray("required") { add("symbol") }
        }
    }

    private fun getCuratedContext() = buildJsonObject {
        put("name", "get_curated_context")
        put("description", "Natural language query across codebase: searches code symbols, knowledge base, and graph relationships. Returns ranked results within token budget.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("query") { put("type", "string"); put("description", "Natural language query (e.g., \"how does authentication work\")") }
                putJsonObject("max_tokens") { put("type", "number"); put("description", "Max tokens for response (default: 4000)") }
                putJsonObject("include_source") { put("type", "boolean"); put("description", "Search code symbols (default: true)") }
                putJsonObject("include_memory") { put("type", "boolean"); put("description", "Search knowledge base (default: true)") }
                putJsonObject("include_graph") { put("type", "boolean"); put("description", "Expand via graph relationships (default: true)") }
                putJsonObject("source_weights") {
                    put("type", "object")
                    put("description", "Custom weights for source ranking")
                    putJsonObject("properties") {
                        putJsonObject("code") { put("type", "number") }
                        putJsonObject("memory") { put("type", "number") }
                        putJsonObject("graph") { put("type", "number") }
                    }
                }
            }
            putJsonArray("required") { add("query") }
        }
    }
}
