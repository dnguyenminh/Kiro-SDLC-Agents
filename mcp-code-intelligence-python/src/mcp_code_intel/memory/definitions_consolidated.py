"""Consolidated MCP tool definitions — 17 tools (14 original + 3 KSA-142). KSA-85."""

from .definitions_consolidated_tier1 import TIER1_TOOLS
from .definitions_consolidated_tier2 import TIER2_TOOLS
from .definitions_consolidated_tier3 import TIER3_TOOLS

# KSA-142: F1/F2/F3 tool definitions
MEM_PIN_TOOL = {
    "name": "mem_pin",
    "description": "Core/Archival Memory: pin entries for auto-recall, manage pinned context budget (2000 tokens max).",
    "inputSchema": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "description": "Action: pin, unpin, list, reorder, get_context, budget"},
            "entry_id": {"type": "number", "description": "Entry ID (for pin/unpin/reorder)"},
            "order": {"type": "number", "description": "New position (for reorder)"},
        },
        "required": ["action"],
    },
}

MEM_CONVERSATION_TOOL = {
    "name": "mem_conversation",
    "description": "Structured conversation history: save turns, query sessions, search conversation content.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "description": "Action: save_turn, get_session, list_sessions, search, summarize"},
            "session_id": {"type": "string", "description": "Session ID (for save_turn/get_session)"},
            "role": {"type": "string", "description": "Role: user, assistant, system, tool (for save_turn)"},
            "content": {"type": "string", "description": "Turn content (for save_turn)"},
            "query": {"type": "string", "description": "Search query (for search)"},
            "tool_calls": {"type": "string", "description": "JSON array of tool calls (for save_turn)"},
            "limit": {"type": "number", "description": "Max results (default: 20)"},
        },
        "required": ["action"],
    },
}

MEM_MAP_TOOL = {
    "name": "mem_map",
    "description": "Structured Map: view/update entry metadata (topic, entities, decisions, action items, sentiment). Search by entity or topic.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "description": "Action: get, update, search_entity, search_topic, reextract"},
            "entry_id": {"type": "number", "description": "Entry ID (for get/update/reextract)"},
            "entity": {"type": "string", "description": "Entity name to search (for search_entity)"},
            "topic": {"type": "string", "description": "Topic to search (for search_topic)"},
            "map": {"type": "object", "description": "Partial StructuredMap to merge (for update)"},
            "limit": {"type": "number", "description": "Max results (default 10)"},
        },
        "required": ["action"],
    },
}

KSA142_TOOLS = [MEM_PIN_TOOL, MEM_CONVERSATION_TOOL, MEM_MAP_TOOL]

MEMORY_TOOL_DEFINITIONS_CONSOLIDATED = TIER1_TOOLS + TIER2_TOOLS + TIER3_TOOLS + KSA142_TOOLS

# Backward-compatible alias mapping: old_name → (new_name, default_args)
TOOL_ALIASES = {
    "mem_get": ("mem_crud", {"action": "get"}),
    "mem_delete": ("mem_crud", {"action": "delete"}),
    "mem_list": ("mem_crud", {"action": "list"}),
    "mem_status": ("mem_admin", {"action": "status"}),
    "mem_audit": ("mem_admin", {"action": "audit"}),
    "mem_sessions": ("mem_admin", {"action": "sessions"}),
    "mem_sync_code": ("mem_admin", {"action": "sync_code"}),
    "mem_consolidate_v2": ("mem_consolidate", {}),
    "mem_stale": ("mem_lifecycle", {"action": "detect_stale"}),
    "mem_due_reviews": ("mem_lifecycle", {"action": "due_reviews"}),
    "mem_review": ("mem_lifecycle", {}),
    "mem_reminders": ("mem_lifecycle", {}),
    "mem_suggest": ("mem_discover", {"action": "suggest"}),
    "mem_related": ("mem_discover", {"action": "related"}),
    "mem_cite": ("mem_citations", {"action": "record"}),
    "mem_quality": ("mem_scoring", {}),
    "mem_confidence": ("mem_scoring", {}),
    "mem_feedback": ("mem_scoring", {}),
    "mem_analytics": ("mem_admin", {"action": "analytics"}),
    "mem_dashboard": ("mem_admin", {"action": "dashboard"}),
}
