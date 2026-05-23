"""MCP tool definitions for memory engine. Prefix: mem_"""

from .definitions_consolidated import (
    MEMORY_TOOL_DEFINITIONS_CONSOLIDATED,
    TOOL_ALIASES,
)
from .definitions_v2 import MEMORY_TOOL_DEFINITIONS_V2

# Expose consolidated (14 tools) as the primary export
MEMORY_TOOL_DEFINITIONS = MEMORY_TOOL_DEFINITIONS_CONSOLIDATED

# Legacy: full 29-tool list for backward compat (internal use only)
_MEMORY_TOOL_DEFINITIONS_LEGACY = [
    {
        "name": "mem_search",
        "description": "Hybrid search across local workspace memory (BM25 + vector + graph). Returns ranked results with progressive disclosure.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "limit": {"type": "number", "description": "Max results (default 10)"},
                "tier": {"type": "string", "description": "Filter by tier: WORKING, EPISODIC, SEMANTIC, PROCEDURAL"},
                "type": {"type": "string", "description": "Filter by type: DECISION, ERROR_PATTERN, ARCHITECTURE, etc."},
                "detail": {"type": "boolean", "description": "If true, include content preview (default: summary only)"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "mem_ingest",
        "description": "Store a knowledge entry into local workspace memory (decision, error pattern, lesson learned, etc).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "content": {"type": "string", "description": "Full content of the knowledge entry"},
                "summary": {"type": "string", "description": "Brief summary (auto-generated if omitted)"},
                "type": {"type": "string", "description": "Type: DECISION, ERROR_PATTERN, ARCHITECTURE, API_DESIGN, REQUIREMENT, LESSON_LEARNED, PROCEDURE, CONTEXT"},
                "source": {"type": "string", "description": "Source identifier (file path, ticket, etc)"},
                "tags": {"type": "string", "description": "Comma-separated tags"},
                "agent_name": {"type": "string", "description": "Agent name (SM, BA, SA, DEV, QA, DevOps, etc.)"},
            },
            "required": ["content"],
        },
    },
    {
        "name": "mem_ingest_file",
        "description": "Ingest a document from disk by file path. Zero-context: server reads file directly, agent only sends path (~80 tokens). Auto-chunks markdown by sections.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "file_path": {"type": "string", "description": "Path to document file (relative to workspace or absolute)"},
                "type": {"type": "string", "description": "Knowledge type: REQUIREMENT, ARCHITECTURE, DECISION, PROCEDURE, CONTEXT (default: CONTEXT)"},
                "format": {"type": "string", "description": "Format: markdown (default) or text"},
            },
            "required": ["file_path"],
        },
    },
    {
        "name": "mem_get",
        "description": "Retrieve a specific memory entry by ID. Records access for consolidation.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {"type": "number", "description": "Entry ID"},
            },
            "required": ["id"],
        },
    },
    {
        "name": "mem_delete",
        "description": "Delete a memory entry by ID with audit trail.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {"type": "number", "description": "Entry ID to delete"},
            },
            "required": ["id"],
        },
    },
    {
        "name": "mem_list",
        "description": "List memory entries filtered by tier or type.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "tier": {"type": "string", "description": "Filter by tier"},
                "type": {"type": "string", "description": "Filter by type"},
                "limit": {"type": "number", "description": "Max results (default 20)"},
            },
        },
    },
    {
        "name": "mem_graph",
        "description": "Query knowledge graph relationships. Actions: neighbors, add_edge, path, ego.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "description": "Action: neighbors, add_edge, path, ego"},
                "node_id": {"type": "number", "description": "Node ID for neighbors/ego"},
                "source_id": {"type": "number", "description": "Source node for add_edge"},
                "target_id": {"type": "number", "description": "Target node for add_edge"},
                "relation": {"type": "string", "description": "Edge relation type"},
                "from_id": {"type": "number", "description": "Start node for path"},
                "to_id": {"type": "number", "description": "End node for path"},
                "radius": {"type": "number", "description": "Radius for ego graph (default 2)"},
            },
        },
    },
    {
        "name": "mem_status",
        "description": "Get local memory system statistics — entry counts, tier breakdown, vector count.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "mem_consolidate",
        "description": "Trigger memory tier consolidation — promotes/demotes entries based on access patterns.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "mem_audit",
        "description": "List recent audit trail entries for local memory operations.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "limit": {"type": "number", "description": "Max results (default 20)"},
                "operation": {"type": "string", "description": "Filter by operation: INGEST, DELETE, SEARCH, CONSOLIDATE, ACCESS"},
            },
        },
    },
    {
        "name": "mem_sessions",
        "description": "List recent memory sessions with observation counts.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "limit": {"type": "number", "description": "Max results (default 20)"},
            },
        },
    },
    {
        "name": "mem_sync_code",
        "description": "Sync code symbols (classes, interfaces) into memory graph with cross-references to documents. Creates CODE_ENTITY nodes and IMPLEMENTED_BY edges.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "kind": {"type": "string", "description": "Filter by kind: class, interface, function (default: class+interface)"},
                "limit": {"type": "number", "description": "Max symbols to sync (default 10000)"},
            },
        },
    },
] + MEMORY_TOOL_DEFINITIONS_V2
