/** Consolidated MCP tool definitions — 14 tools (merged from 29). KSA-85. */
package com.codeintel.memory.tools

import kotlinx.serialization.json.*

object MemoryToolDefinitionsConsolidated {
    val ALL: List<JsonObject> by lazy {
        listOf(
            memSearch(), memIngest(), memIngestFile(), memCrud(),
            memGraph(), memConsolidate(), memLifecycle(), memTemplates(),
            memAttachments(), memDiscover(), memTags(), memCitations(),
            memScoring(), memAdmin()
        )
    }

    private fun memSearch() = tool(
        "mem_search",
        "Hybrid search across local workspace memory (BM25 + vector + graph). Returns ranked results with progressive disclosure.",
        required = listOf("query")
    ) {
        prop("query", "string", "Search query")
        prop("limit", "number", "Max results (default 10)")
        prop("tier", "string", "Filter by tier: WORKING, EPISODIC, SEMANTIC, PROCEDURAL")
        prop("type", "string", "Filter by type: DECISION, ERROR_PATTERN, ARCHITECTURE, etc.")
        prop("detail", "boolean", "If true, include content preview (default: summary only)")
    }

    private fun memIngest() = tool(
        "mem_ingest",
        "Store a knowledge entry into local workspace memory (decision, error pattern, lesson learned, etc).",
        required = listOf("content")
    ) {
        prop("content", "string", "Full content of the knowledge entry")
        prop("summary", "string", "Brief summary (auto-generated if omitted)")
        prop("type", "string", "Type: DECISION, ERROR_PATTERN, ARCHITECTURE, API_DESIGN, REQUIREMENT, LESSON_LEARNED, PROCEDURE, CONTEXT")
        prop("source", "string", "Source identifier (file path, ticket, etc)")
        prop("tags", "string", "Comma-separated tags")
    }

    private fun memIngestFile() = tool(
        "mem_ingest_file",
        "Ingest a document from disk by file path. Zero-context: server reads file directly (~80 tokens). Auto-chunks markdown.",
        required = listOf("file_path")
    ) {
        prop("file_path", "string", "Path to document file (relative to workspace or absolute)")
        prop("type", "string", "Knowledge type: REQUIREMENT, ARCHITECTURE, DECISION, PROCEDURE, CONTEXT (default: CONTEXT)")
        prop("format", "string", "Format: markdown (default) or text")
    }

    private fun memCrud() = tool(
        "mem_crud",
        "CRUD operations on knowledge entries: get, delete, list.",
        required = listOf("action")
    ) {
        prop("action", "string", "Action: get, delete, list")
        prop("id", "number", "Entry ID (for get/delete)")
        prop("tier", "string", "Filter by tier (for list)")
        prop("type", "string", "Filter by type (for list)")
        prop("limit", "number", "Max results (for list, default 20)")
    }

    private fun memGraph() = tool(
        "mem_graph",
        "Query knowledge graph relationships. Actions: neighbors, add_edge, path, ego."
    ) {
        prop("action", "string", "Action: neighbors, add_edge, path, ego")
        prop("node_id", "number", "Node ID for neighbors/ego")
        prop("source_id", "number", "Source node for add_edge")
        prop("target_id", "number", "Target node for add_edge")
        prop("relation", "string", "Edge relation type")
        prop("from_id", "number", "Start node for path")
        prop("to_id", "number", "End node for path")
        prop("radius", "number", "Radius for ego graph (default 2)")
    }

    private fun memConsolidate() = tool(
        "mem_consolidate",
        "Tier consolidation: promote/demote entries, merge duplicates with dry-run support."
    ) {
        prop("action", "string", "Action: consolidate, merge (default: consolidate)")
        prop("dry_run", "boolean", "Preview changes without applying (default: false)")
        prop("survivor_id", "number", "For merge: ID of entry to keep")
        prop("merge_ids", "string", "For merge: comma-separated IDs to merge into survivor")
        prop("strategy", "string", "Merge strategy: append, newest (default: append)")
    }

    private fun memLifecycle() = tool(
        "mem_lifecycle",
        "Entry lifecycle: staleness detection, reviews, reminders.",
        required = listOf("action")
    ) {
        prop("action", "string", "Action: detect_stale, archive, unarchive, due_reviews, mark_reviewed, schedule, snooze, complete")
        prop("entry_id", "number", "Entry ID")
        prop("threshold", "number", "Staleness threshold 0-1 (default: 0.8)")
        prop("dry_run", "boolean", "Preview without applying (default: false)")
        prop("days", "number", "Days since last review (for due_reviews, default: 90)")
        prop("interval_days", "number", "Review interval in days (for schedule)")
        prop("snooze_days", "number", "Snooze duration in days (default: 7)")
        prop("reviewer", "string", "Reviewer identifier")
        prop("assignee", "string", "Assignee for reminder")
        prop("owner", "string", "Owner identifier")
        prop("status", "string", "Review status: pending, approved, rejected, needs_revision")
        prop("limit", "number", "Max results (default: 20)")
    }

    private fun memTemplates() = tool(
        "mem_templates",
        "Manage content templates: create, list, validate entries against templates."
    ) {
        prop("action", "string", "Action: create, list, validate")
        prop("name", "string", "Template name (for create)")
        prop("type", "string", "Entry type this template applies to")
        prop("required_sections", "string", "Comma-separated required section names")
        prop("entry_id", "number", "Entry ID to validate")
    }

    private fun memAttachments() = tool(
        "mem_attachments",
        "Manage file attachments for knowledge entries."
    ) {
        prop("action", "string", "Action: attach, list, remove, search")
        prop("entry_id", "number", "Entry ID")
        prop("file_path", "string", "File path to attach")
        prop("description", "string", "Attachment description")
        prop("attachment_id", "number", "Attachment ID (for remove)")
        prop("mime_prefix", "string", "MIME type prefix for search (e.g., 'image/')")
    }

    private fun memDiscover() = tool(
        "mem_discover",
        "Find relevant entries: type-ahead suggestions or related entries.",
        required = listOf("action")
    ) {
        prop("action", "string", "Action: suggest, related")
        prop("query", "string", "Partial query (for suggest)")
        prop("entry_id", "number", "Entry ID (for related)")
        prop("limit", "number", "Max results (default: 5)")
        prop("refresh", "boolean", "Force recompute related (default: false)")
    }

    private fun memTags() = tool(
        "mem_tags",
        "Manage tag taxonomy: create tags, tag/untag entries, search by tags, view taxonomy."
    ) {
        prop("action", "string", "Action: create, tag, untag, search, taxonomy, popular, entry_tags")
        prop("tag", "string", "Tag name (for create)")
        prop("tags", "string", "Comma-separated tags (for tag/untag/search)")
        prop("entry_id", "number", "Entry ID (for tag/untag/entry_tags)")
        prop("category", "string", "Tag category (for create/taxonomy)")
        prop("parent_tag", "string", "Parent tag (for hierarchical create)")
        prop("operator", "string", "Search operator: AND, OR (default: AND)")
        prop("limit", "number", "Max results")
    }

    private fun memCitations() = tool(
        "mem_citations",
        "Citation tracking: record citations, view most/least cited entries.",
        required = listOf("action")
    ) {
        prop("action", "string", "Action: record, entry, most_cited, uncited, by_agent")
        prop("entry_id", "number", "Entry ID")
        prop("cited_by", "string", "Who/what is citing (for record)")
        prop("context", "string", "Context of the citation (for record)")
        prop("agent", "string", "Agent name (for by_agent)")
        prop("limit", "number", "Max results (default: 10)")
    }

    private fun memScoring() = tool(
        "mem_scoring",
        "Quality & confidence scoring + feedback for entries.",
        required = listOf("action")
    ) {
        prop("action", "string", "Action: quality_score, quality_stats, low_quality, validate, confidence, confidence_stats, unreliable, feedback_submit, feedback_view, top_rated, low_rated")
        prop("entry_id", "number", "Entry ID")
        prop("content", "string", "Content to validate (for validate action)")
        prop("type", "string", "Entry type (for validate)")
        prop("threshold", "number", "Quality threshold (default: 40)")
        prop("rating", "number", "Rating: 1 (thumbs up) or -1 (thumbs down)")
        prop("comment", "string", "Feedback comment")
        prop("limit", "number", "Max results (default: 20)")
    }

    private fun memAdmin() = tool(
        "mem_admin",
        "System administration: status, audit trail, sessions, analytics, dashboard, code sync.",
        required = listOf("action")
    ) {
        prop("action", "string", "Action: status, audit, sessions, analytics, dashboard, sync_code, popular, gaps, zero_results, metrics, recommendations, trends")
        prop("limit", "number", "Max results (default: 20)")
        prop("operation", "string", "Filter audit by operation: INGEST, DELETE, SEARCH, CONSOLIDATE, ACCESS")
        prop("days", "number", "Trend period in days (default: 30)")
        prop("kind", "string", "For sync_code: class, interface, function (default: class+interface)")
    }

    // --- DSL helpers (extracted to ToolSchemaDsl.kt) ---

    private fun tool(
        name: String, description: String,
        required: List<String> = emptyList(),
        block: ToolSchemaDsl.() -> Unit = {}
    ): JsonObject = ToolSchemaDsl.build(name, description, required, block)
}
