/** MCP tool definitions for local workspace memory engine. Prefix: mem_ */
package com.codeintel.memory.tools

import kotlinx.serialization.json.*

object MemoryToolDefinitions {
    val ALL: List<JsonObject> by lazy {
        listOf(memSearch(), memIngest(), memIngestFile(), memSyncCode(), memGet(), memDelete(), memList(), memGraph(), memStatus(), memConsolidate(), memAudit(), memSessions())
    }

    private fun memSearch() = buildJsonObject {
        put("name", "mem_search")
        put("description", "Hybrid search across local workspace memory (BM25 + vector + graph). Returns ranked results with progressive disclosure.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("query") { put("type", "string"); put("description", "Search query") }
                putJsonObject("limit") { put("type", "number"); put("description", "Max results (default 10)") }
                putJsonObject("tier") { put("type", "string"); put("description", "Filter by tier: WORKING, EPISODIC, SEMANTIC, PROCEDURAL") }
                putJsonObject("type") { put("type", "string"); put("description", "Filter by type: DECISION, ERROR_PATTERN, ARCHITECTURE, etc.") }
                putJsonObject("role") { put("type", "string"); put("description", "Agent role filter: DEV, BA, QA, SA, DEVOPS. Filters results to role-relevant types.") }
                putJsonObject("detail") { put("type", "boolean"); put("description", "If true, include content preview (default: summary only)") }
            }
            putJsonArray("required") { add("query") }
        }
    }

    private fun memIngest() = buildJsonObject {
        put("name", "mem_ingest")
        put("description", "Store a knowledge entry into local workspace memory (decision, error pattern, lesson learned, etc).")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("content") { put("type", "string"); put("description", "Full content of the knowledge entry") }
                putJsonObject("summary") { put("type", "string"); put("description", "Brief summary (auto-generated if omitted)") }
                putJsonObject("type") { put("type", "string"); put("description", "Type: DECISION, ERROR_PATTERN, ARCHITECTURE, API_DESIGN, REQUIREMENT, LESSON_LEARNED, PROCEDURE, CONTEXT") }
                putJsonObject("source") { put("type", "string"); put("description", "Source identifier (file path, ticket, etc)") }
                putJsonObject("tags") { put("type", "string"); put("description", "Comma-separated tags") }
            }
            putJsonArray("required") { add("content") }
        }
    }

    private fun memIngestFile() = buildJsonObject {
        put("name", "mem_ingest_file")
        put("description", "Ingest a document from disk by file path. Zero-context: server reads file directly, agent only sends path (~80 tokens). Auto-chunks markdown by sections.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("file_path") { put("type", "string"); put("description", "Path to document file (relative to workspace or absolute)") }
                putJsonObject("type") { put("type", "string"); put("description", "Knowledge type: REQUIREMENT, ARCHITECTURE, DECISION, PROCEDURE, CONTEXT (default: CONTEXT)") }
                putJsonObject("format") { put("type", "string"); put("description", "Format: markdown (default) or text") }
            }
            putJsonArray("required") { add("file_path") }
        }
    }

    private fun memSyncCode() = buildJsonObject {
        put("name", "mem_sync_code")
        put("description", "Sync code symbols (classes, interfaces) into memory graph with cross-references to documents. Creates CODE_ENTITY nodes and IMPLEMENTED_BY edges.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("limit") { put("type", "number"); put("description", "Max symbols to sync (default 10000)") }
                putJsonObject("kind") { put("type", "string"); put("description", "Filter by kind: class, interface, function (default: class+interface)") }
            }
        }
    }

    private fun memGet() = buildJsonObject {
        put("name", "mem_get")
        put("description", "Retrieve a specific memory entry by ID. Records access for consolidation.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("id") { put("type", "number"); put("description", "Entry ID") }
            }
            putJsonArray("required") { add("id") }
        }
    }

    private fun memDelete() = buildJsonObject {
        put("name", "mem_delete")
        put("description", "Delete a memory entry by ID with audit trail.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("id") { put("type", "number"); put("description", "Entry ID to delete") }
            }
            putJsonArray("required") { add("id") }
        }
    }

    private fun memList() = buildJsonObject {
        put("name", "mem_list")
        put("description", "List memory entries filtered by tier or type.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("tier") { put("type", "string"); put("description", "Filter by tier") }
                putJsonObject("type") { put("type", "string"); put("description", "Filter by type") }
                putJsonObject("limit") { put("type", "number"); put("description", "Max results (default 20)") }
            }
        }
    }

    private fun memGraph() = buildJsonObject {
        put("name", "mem_graph")
        put("description", "Query knowledge graph relationships. Actions: neighbors, add_edge, path, ego.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("action") { put("type", "string"); put("description", "Action: neighbors, add_edge, path, ego") }
                putJsonObject("node_id") { put("type", "number"); put("description", "Node ID for neighbors/ego") }
                putJsonObject("source_id") { put("type", "number"); put("description", "Source node for add_edge") }
                putJsonObject("target_id") { put("type", "number"); put("description", "Target node for add_edge") }
                putJsonObject("relation") { put("type", "string"); put("description", "Edge relation type") }
                putJsonObject("from_id") { put("type", "number"); put("description", "Start node for path") }
                putJsonObject("to_id") { put("type", "number"); put("description", "End node for path") }
                putJsonObject("radius") { put("type", "number"); put("description", "Radius for ego graph (default 2)") }
            }
        }
    }

    private fun memStatus() = buildJsonObject {
        put("name", "mem_status")
        put("description", "Get local memory system statistics — entry counts, tier breakdown, vector count.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {}
        }
    }

    private fun memConsolidate() = buildJsonObject {
        put("name", "mem_consolidate")
        put("description", "Trigger memory tier consolidation — promotes/demotes entries based on access patterns.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {}
        }
    }

    private fun memAudit() = buildJsonObject {
        put("name", "mem_audit")
        put("description", "List recent audit trail entries for local memory operations.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("limit") { put("type", "number"); put("description", "Max results (default 20)") }
                putJsonObject("operation") { put("type", "string"); put("description", "Filter by operation: INGEST, DELETE, SEARCH, CONSOLIDATE, ACCESS") }
            }
        }
    }

    private fun memSessions() = buildJsonObject {
        put("name", "mem_sessions")
        put("description", "List recent memory sessions with observation counts.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("limit") { put("type", "number"); put("description", "Max results (default 20)") }
            }
        }
    }
}
