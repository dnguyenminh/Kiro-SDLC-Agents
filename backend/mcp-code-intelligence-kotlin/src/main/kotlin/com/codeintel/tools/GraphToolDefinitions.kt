/** MCP tool definitions for graph tools — code_callers, code_callees, code_traverse, code_impact, code_dependencies. KSA-171. */
package com.codeintel.tools

import kotlinx.serialization.json.*

object GraphToolDefinitions {
    val ALL: List<JsonObject> by lazy {
        listOf(codeCallers(), codeCallees(), codeTraverse(), codeImpact(), codeDependencies())
    }

    private fun codeCallers() = buildJsonObject {
        put("name", "code_callers")
        put("description", "Find all callers of a function/method with transitive depth control. Supports qualified names (Class.method) and file:symbol format.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("symbol") { put("type", "string"); put("description", "Symbol name to find callers for (e.g. \"processData\", \"MyClass.method\", \"src/utils:helper\")") }
                putJsonObject("depth") { put("type", "number"); put("description", "Transitive depth (1-5, default 1)") }
                putJsonObject("limit") { put("type", "number"); put("description", "Max results (default 20)") }
                putJsonObject("file_filter") { put("type", "string"); put("description", "Filter results by file path pattern (glob)") }
                putJsonObject("kind_filter") { put("type", "string"); put("description", "Relationship kind filter (default: calls)") }
            }
            putJsonArray("required") { add("symbol") }
        }
    }

    private fun codeCallees() = buildJsonObject {
        put("name", "code_callees")
        put("description", "Find all functions/methods called by a given symbol with transitive depth.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("symbol") { put("type", "string"); put("description", "Symbol name to find callees for") }
                putJsonObject("depth") { put("type", "number"); put("description", "Transitive depth (1-5, default 1)") }
                putJsonObject("limit") { put("type", "number"); put("description", "Max results (default 20)") }
                putJsonObject("file_filter") { put("type", "string"); put("description", "Filter results by file path pattern (glob)") }
                putJsonObject("include_external") { put("type", "boolean"); put("description", "Include external/unresolved callees (default true)") }
            }
            putJsonArray("required") { add("symbol") }
        }
    }

    private fun codeTraverse() = buildJsonObject {
        put("name", "code_traverse")
        put("description", "Generic graph traversal with custom edge/node type filters. Traverse the code relationship graph from any symbol with fine-grained control.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("start") { put("type", "string"); put("description", "Start symbol (e.g. \"MyClass\", \"MyClass.method\", \"file.kt:func\")") }
                putJsonObject("edge_types") { put("type", "array"); putJsonObject("items") { put("type", "string") }; put("description", "Filter by edge types: calls, imports, inherits, implements, uses, decorates (default: all)") }
                putJsonObject("node_types") { put("type", "array"); putJsonObject("items") { put("type", "string") }; put("description", "Filter by node types: function, class, interface, method, variable (default: all)") }
                putJsonObject("direction") { put("type", "string"); put("description", "Traversal direction: outgoing, incoming, both (default: outgoing)") }
                putJsonObject("max_depth") { put("type", "number"); put("description", "Maximum traversal depth 1-10 (default: 3)") }
                putJsonObject("max_results") { put("type", "number"); put("description", "Maximum results (default: 50)") }
                putJsonObject("include_source") { put("type", "boolean"); put("description", "Include source code snippets (default: false)") }
                putJsonObject("source_lines") { put("type", "number"); put("description", "Lines of source to include (default: 5)") }
            }
            putJsonArray("required") { add("start") }
        }
    }

    private fun codeImpact() = buildJsonObject {
        put("name", "code_impact")
        put("description", "Predict blast radius of modifying, deleting, or renaming a symbol. Shows affected callers, dependents, tests, and provides recommendations.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("symbol") { put("type", "string"); put("description", "Symbol name to analyze impact for") }
                putJsonObject("action") { put("type", "string"); put("description", "Type of change: modify, delete, rename (default: modify)") }
                putJsonObject("depth") { put("type", "number"); put("description", "Analysis depth 1-5 (default: 3)") }
                putJsonObject("include_tests") { put("type", "boolean"); put("description", "Include affected test files (default: true)") }
                putJsonObject("severity_threshold") { put("type", "string"); put("description", "Minimum severity to include: critical, high, medium, low (default: low)") }
            }
            putJsonArray("required") { add("symbol") }
        }
    }

    private fun codeDependencies() = buildJsonObject {
        put("name", "code_dependencies")
        put("description", "Analyze file/module import dependencies with direction and depth control. Shows what a file imports (outgoing) or what imports it (incoming).")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("file") { put("type", "string"); put("description", "File path to analyze (relative or absolute)") }
                putJsonObject("direction") { put("type", "string"); put("description", "Direction: incoming, outgoing, both (default: outgoing)") }
                putJsonObject("depth") { put("type", "number"); put("description", "Traversal depth 1-5 (default: 1)") }
                putJsonObject("include_external") { put("type", "boolean"); put("description", "Include external/stdlib dependencies (default: false)") }
                putJsonObject("format") { put("type", "string"); put("description", "Output format: tree, flat, graph (default: tree)") }
                putJsonObject("limit") { put("type", "number"); put("description", "Max results (default: 50)") }
            }
            putJsonArray("required") { add("file") }
        }
    }
}
