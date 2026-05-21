"""MCP tool definitions V2 — new tools for KB Enhancement (KSA-68)."""

MEMORY_TOOL_DEFINITIONS_V2 = [
    # KSA-69: Real Consolidation Engine
    {
        "name": "mem_consolidate_v2",
        "description": "Real consolidation engine: promote, demote, and merge entries with dry-run support.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "description": "Action: consolidate, merge"},
                "dry_run": {"type": "boolean", "description": "Preview changes without applying (default: false)"},
                "survivor_id": {"type": "number", "description": "For merge: ID of entry to keep"},
                "merge_ids": {"type": "string", "description": "For merge: comma-separated IDs to merge into survivor"},
                "strategy": {"type": "string", "description": "Merge strategy: append, newest (default: append)"},
            },
        },
    },
    # KSA-70: Staleness Detection
    {
        "name": "mem_stale",
        "description": "Detect stale entries and auto-archive. Shows entries that haven't been accessed or reviewed recently.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "description": "Action: detect, archive, unarchive"},
                "threshold": {"type": "number", "description": "Staleness threshold 0-1 (default: 0.8)"},
                "entry_id": {"type": "number", "description": "For unarchive: entry ID to restore"},
                "dry_run": {"type": "boolean", "description": "Preview without archiving (default: false)"},
            },
        },
    },
    {
        "name": "mem_due_reviews",
        "description": "List entries due for review (not reviewed in N days).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "days": {"type": "number", "description": "Days since last review (default: 90)"},
                "limit": {"type": "number", "description": "Max results (default: 20)"},
            },
        },
    },
    {
        "name": "mem_review",
        "description": "Mark an entry as reviewed, assign owner/reviewer, set review status.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "description": "Action: mark_reviewed, assign_owner, assign_reviewer, set_status"},
                "entry_id": {"type": "number", "description": "Entry ID"},
                "owner": {"type": "string", "description": "Owner identifier"},
                "reviewer": {"type": "string", "description": "Reviewer identifier"},
                "status": {"type": "string", "description": "Review status: pending, approved, rejected, needs_revision"},
            },
            "required": ["entry_id"],
        },
    },
    # KSA-73: Template Enforcement
    {
        "name": "mem_templates",
        "description": "Manage content templates: create, list, validate entries against templates.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "description": "Action: create, list, validate"},
                "name": {"type": "string", "description": "Template name (for create)"},
                "type": {"type": "string", "description": "Entry type this template applies to"},
                "required_sections": {"type": "string", "description": "Comma-separated required section names"},
                "entry_id": {"type": "number", "description": "Entry ID to validate"},
            },
        },
    },
    # KSA-75: Attachments
    {
        "name": "mem_attachments",
        "description": "Manage file attachments for knowledge entries.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "description": "Action: attach, list, remove, search"},
                "entry_id": {"type": "number", "description": "Entry ID"},
                "file_path": {"type": "string", "description": "File path to attach"},
                "description": {"type": "string", "description": "Attachment description"},
                "attachment_id": {"type": "number", "description": "Attachment ID (for remove)"},
                "mime_prefix": {"type": "string", "description": "MIME type prefix for search (e.g., 'image/')"},
            },
        },
    },
    # KSA-76: Suggestions & Related
    {
        "name": "mem_suggest",
        "description": "Type-ahead suggestions as user types a query. Returns top matching entries.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Partial query for suggestions"},
                "limit": {"type": "number", "description": "Max suggestions (default: 5)"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "mem_related",
        "description": "Get related entries for a given entry (uses tags + graph + FTS signals).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "entry_id": {"type": "number", "description": "Entry ID to find related entries for"},
                "limit": {"type": "number", "description": "Max related entries (default: 5)"},
                "refresh": {"type": "boolean", "description": "Force recompute (default: false)"},
            },
            "required": ["entry_id"],
        },
    },
    # KSA-77: Tag Taxonomy
    {
        "name": "mem_tags",
        "description": "Manage tag taxonomy: create tags, tag/untag entries, search by tags, view taxonomy.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "description": "Action: create, tag, untag, search, taxonomy, popular, entry_tags"},
                "tag": {"type": "string", "description": "Tag name (for create)"},
                "tags": {"type": "string", "description": "Comma-separated tags (for tag/untag/search)"},
                "entry_id": {"type": "number", "description": "Entry ID (for tag/untag/entry_tags)"},
                "category": {"type": "string", "description": "Tag category (for create/taxonomy)"},
                "parent_tag": {"type": "string", "description": "Parent tag (for hierarchical create)"},
                "operator": {"type": "string", "description": "Search operator: AND, OR (default: AND)"},
                "limit": {"type": "number", "description": "Max results"},
            },
        },
    },
    # KSA-78: Search Analytics
    {
        "name": "mem_analytics",
        "description": "Search analytics: popular queries, zero-result queries, content gaps, click-through rates.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "description": "Action: summary, popular, gaps, zero_results"},
                "limit": {"type": "number", "description": "Max results (default: 10)"},
            },
        },
    },
    # KSA-79: Citations
    {
        "name": "mem_cite",
        "description": "Record a citation when an entry is used/referenced by an agent or user.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "entry_id": {"type": "number", "description": "Entry ID being cited"},
                "cited_by": {"type": "string", "description": "Who/what is citing (agent name, user ID)"},
                "context": {"type": "string", "description": "Context of the citation"},
            },
            "required": ["entry_id", "cited_by"],
        },
    },
    {
        "name": "mem_citations",
        "description": "View citation data: citations for an entry, most cited, uncited entries.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "description": "Action: entry, most_cited, uncited, by_agent"},
                "entry_id": {"type": "number", "description": "Entry ID (for entry action)"},
                "agent": {"type": "string", "description": "Agent name (for by_agent action)"},
                "limit": {"type": "number", "description": "Max results (default: 10)"},
            },
        },
    },
    # KSA-81: Feedback
    {
        "name": "mem_feedback",
        "description": "Submit and view feedback (thumbs up/down) for knowledge entries.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "description": "Action: submit, summary, low_rated, top_rated"},
                "entry_id": {"type": "number", "description": "Entry ID"},
                "rating": {"type": "number", "description": "Rating: 1 (thumbs up) or -1 (thumbs down)"},
                "comment": {"type": "string", "description": "Optional feedback comment"},
                "limit": {"type": "number", "description": "Max results (default: 10)"},
            },
        },
    },
    # KSA-72: Scheduled Review Reminders
    {
        "name": "mem_reminders",
        "description": "Manage scheduled review reminders: list due, schedule, snooze, dismiss, complete.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "description": "Action: due, schedule, snooze, dismiss, complete, auto_schedule, stats"},
                "entry_id": {"type": "number", "description": "Entry ID"},
                "interval_days": {"type": "number", "description": "Review interval in days"},
                "snooze_days": {"type": "number", "description": "Snooze duration in days (default: 7)"},
                "assignee": {"type": "string", "description": "Assignee for the reminder"},
                "reviewer": {"type": "string", "description": "Reviewer who completed review"},
                "limit": {"type": "number", "description": "Max results (default: 20)"},
            },
        },
    },
    # KSA-74: Content Quality Scoring
    {
        "name": "mem_quality",
        "description": "Score and validate content quality. Compute quality scores, find low-quality entries, get stats.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "description": "Action: score, score_all, low_quality, stats, validate"},
                "entry_id": {"type": "number", "description": "Entry ID to score"},
                "content": {"type": "string", "description": "Content to validate (for pre-ingest check)"},
                "type": {"type": "string", "description": "Entry type (for validate action)"},
                "threshold": {"type": "number", "description": "Quality threshold (default: 40)"},
                "limit": {"type": "number", "description": "Max results (default: 20)"},
            },
        },
    },
    # KSA-80: Confidence Scoring
    {
        "name": "mem_confidence",
        "description": "Compute and query confidence scores for search results. Based on quality, citations, feedback, freshness.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "description": "Action: compute, batch, unreliable, stats"},
                "entry_id": {"type": "number", "description": "Entry ID to compute confidence for"},
                "limit": {"type": "number", "description": "Max results (default: 20)"},
            },
        },
    },
    # KSA-84: KB Health Dashboard
    {
        "name": "mem_dashboard",
        "description": "KB health dashboard with metrics, recommendations, and trends.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "description": "Action: full, metrics, recommendations, trends"},
                "days": {"type": "number", "description": "Trend period in days (default: 30)"},
            },
        },
    },
]
