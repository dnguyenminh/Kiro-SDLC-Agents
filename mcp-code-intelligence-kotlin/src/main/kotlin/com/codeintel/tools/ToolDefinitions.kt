/** MCP tool definitions — JSON schemas for all tools. */
package com.codeintel.tools

import com.codeintel.analyzers.similarity.SimilarityToolDefinitions
import kotlinx.serialization.json.*

object ToolDefinitions {
    val ALL: List<JsonObject> by lazy {
        listOf(codeSearch(), codeSymbols(), codeContext(), codeModules(), codeIndexStatus(), streamWriteFile(), codeKbExport(), drawioAutoLayout()) +
            GraphToolDefinitions.ALL +
            ContextToolDefinitions.ALL +
            SimilarityToolDefinitions.ALL
    }

    private fun codeSearch() = buildJsonObject {
        put("name", "code_search")
        put("description", "Full-text search across indexed code symbols (functions, classes, interfaces). Uses SQLite FTS5 with porter stemming.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("query") { put("type", "string"); put("description", "Search query (supports FTS5 syntax: AND, OR, NOT, prefix*)") }
                putJsonObject("limit") { put("type", "number"); put("description", "Max results (default 20)") }
            }
            putJsonArray("required") { add("query") }
        }
    }

    private fun codeSymbols() = buildJsonObject {
        put("name", "code_symbols")
        put("description", "Find code symbols by name prefix or list symbols in a file. Filter by kind (function, class, interface, etc).")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("name") { put("type", "string"); put("description", "Symbol name or prefix to search") }
                putJsonObject("file") { put("type", "string"); put("description", "File path to list symbols from") }
                putJsonObject("kind") { put("type", "string"); put("description", "Filter by kind: function, class, interface, enum, type, method") }
                putJsonObject("limit") { put("type", "number"); put("description", "Max results") }
            }
        }
    }

    private fun codeContext() = buildJsonObject {
        put("name", "code_context")
        put("description", "Get source code context around a symbol or line range. Returns actual code lines from the file.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("file") { put("type", "string"); put("description", "Relative file path") }
                putJsonObject("symbol") { put("type", "string"); put("description", "Symbol name to find in file") }
                putJsonObject("startLine") { put("type", "number"); put("description", "Start line (1-based)") }
                putJsonObject("endLine") { put("type", "number"); put("description", "End line (1-based)") }
                putJsonObject("contextLines") { put("type", "number"); put("description", "Extra lines above/below (default 5)") }
            }
            putJsonArray("required") { add("file") }
        }
    }

    private fun codeModules() = buildJsonObject {
        put("name", "code_modules")
        put("description", "List all discovered code modules in the workspace with file counts, languages, and descriptions.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("name") { put("type", "string"); put("description", "Filter by module name (prefix match)") }
            }
        }
    }

    private fun codeIndexStatus() = buildJsonObject {
        put("name", "code_index_status")
        put("description", "Get current indexing status: file count, symbol count, languages, last indexed time, and indexer state.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("reindex") { put("type", "boolean"); put("description", "Trigger a full re-index (default false)") }
            }
        }
    }

    private fun streamWriteFile() = buildJsonObject {
        put("name", "stream_write_file")
        put("description", "Write content directly to a file on disk. Modes: write (overwrite), append, create (fail if exists).")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("file_path") { put("type", "string"); put("description", "Path to file (absolute or relative to workspace)") }
                putJsonObject("content") { put("type", "string"); put("description", "Text content to write") }
                putJsonObject("mode") { put("type", "string"); put("description", "write, append, or create (default: write)") }
                putJsonObject("encoding") { put("type", "string"); put("description", "Encoding (default: utf-8)") }
            }
            putJsonArray("required") { add("file_path") }
        }
    }

    private fun codeKbExport() = buildJsonObject {
        put("name", "code_kb_export")
        put("description", "Export code intelligence data as Knowledge Base payloads for ingestion. Returns structured data ready for kb_ingest.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("module") { put("type", "string"); put("description", "Filter by module name (optional, exports all if omitted)") }
                putJsonObject("format") { put("type", "string"); put("description", "Output format: json (default) or text") }
            }
        }
    }

    private fun drawioAutoLayout() = buildJsonObject {
        put("name", "drawio_auto_layout")
        put("description", "Auto-layout draw.io diagrams using graph algorithms. Reads .drawio file, computes optimal node positions, writes back. Preserves all styles/labels.")
        putJsonObject("inputSchema") {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("file_path") { put("type", "string"); put("description", "Path to .drawio file (absolute or relative to workspace)") }
                putJsonObject("algorithm") { put("type", "string"); put("description", "Layout algorithm: layered|force|mrtree|radial (default: layered)") }
                putJsonObject("spacing") { put("type", "number"); put("description", "Node spacing in pixels (default: 80)") }
                putJsonObject("direction") { put("type", "string"); put("description", "Layout direction: DOWN|RIGHT|LEFT|UP (default: DOWN)") }
                putJsonObject("export_png") { put("type", "boolean"); put("description", "Also export PNG after layout (default: false)") }
                putJsonObject("force") { put("type", "boolean"); put("description", "Force re-layout even if diagram has no overlaps (default: false)") }
            }
            putJsonArray("required") { add("file_path") }
        }
    }
}
