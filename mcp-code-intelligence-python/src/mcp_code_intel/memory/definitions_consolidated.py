"""Consolidated MCP tool definitions — 14 tools (merged from 29). KSA-85."""

from .definitions_consolidated_tier1 import TIER1_TOOLS
from .definitions_consolidated_tier2 import TIER2_TOOLS
from .definitions_consolidated_tier3 import TIER3_TOOLS

MEMORY_TOOL_DEFINITIONS_CONSOLIDATED = TIER1_TOOLS + TIER2_TOOLS + TIER3_TOOLS

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
