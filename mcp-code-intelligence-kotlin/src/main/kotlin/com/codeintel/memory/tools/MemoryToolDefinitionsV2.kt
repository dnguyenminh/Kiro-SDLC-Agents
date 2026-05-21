/** MCP tool definitions V2 — KB Enhancement tools (KSA-68). */
package com.codeintel.memory.tools

import kotlinx.serialization.json.*

object MemoryToolDefinitionsV2 {
    val ALL: List<JsonObject> by lazy {
        listOf(
            memConsolidateV2(), memStale(), memDueReviews(), memReview(),
            memTemplates(), memAttachments(), memSuggest(), memRelated(),
            memTags(), memAnalytics(), memCite(), memCitations(),
            memFeedback(), memReminders(), memQuality(), memConfidence(),
            memDashboard()
        )
    }

    private fun memConsolidateV2() = buildTool("mem_consolidate_v2",
        "Real consolidation engine: promote, demote, and merge entries with dry-run support.") {
        prop("action", "string", "Action: consolidate, merge")
        prop("dry_run", "boolean", "Preview changes without applying (default: false)")
        prop("survivor_id", "number", "For merge: ID of entry to keep")
        prop("merge_ids", "string", "For merge: comma-separated IDs to merge into survivor")
        prop("strategy", "string", "Merge strategy: append, newest (default: append)")
    }

    private fun memStale() = buildTool("mem_stale",
        "Detect stale entries and auto-archive.") {
        prop("action", "string", "Action: detect, archive, unarchive")
        prop("threshold", "number", "Staleness threshold 0-1 (default: 0.8)")
        prop("entry_id", "number", "For unarchive: entry ID to restore")
        prop("dry_run", "boolean", "Preview without archiving (default: false)")
    }

    private fun memDueReviews() = buildTool("mem_due_reviews",
        "List entries due for review (not reviewed in N days).") {
        prop("days", "number", "Days since last review (default: 90)")
        prop("limit", "number", "Max results (default: 20)")
    }

    private fun memReview() = buildToolRequired("mem_review",
        "Mark an entry as reviewed, assign owner/reviewer, set review status.",
        listOf("entry_id")) {
        prop("action", "string", "Action: mark_reviewed, assign_owner, assign_reviewer, set_status")
        prop("entry_id", "number", "Entry ID")
        prop("owner", "string", "Owner identifier")
        prop("reviewer", "string", "Reviewer identifier")
        prop("status", "string", "Review status: pending, approved, rejected, needs_revision")
    }

    private fun memTemplates() = buildTool("mem_templates",
        "Manage content templates: create, list, validate entries against templates.") {
        prop("action", "string", "Action: create, list, validate")
        prop("name", "string", "Template name (for create)")
        prop("type", "string", "Entry type this template applies to")
        prop("required_sections", "string", "Comma-separated required section names")
        prop("entry_id", "number", "Entry ID to validate")
    }

    private fun memAttachments() = buildTool("mem_attachments",
        "Manage file attachments for knowledge entries.") {
        prop("action", "string", "Action: attach, list, remove, search")
        prop("entry_id", "number", "Entry ID")
        prop("file_path", "string", "File path to attach")
        prop("description", "string", "Attachment description")
        prop("attachment_id", "number", "Attachment ID (for remove)")
        prop("mime_prefix", "string", "MIME type prefix for search")
    }

    private fun memSuggest() = buildToolRequired("mem_suggest",
        "Type-ahead suggestions as user types a query.", listOf("query")) {
        prop("query", "string", "Partial query for suggestions")
        prop("limit", "number", "Max suggestions (default: 5)")
    }

    private fun memRelated() = buildToolRequired("mem_related",
        "Get related entries for a given entry (uses tags + graph + FTS signals).",
        listOf("entry_id")) {
        prop("entry_id", "number", "Entry ID to find related entries for")
        prop("limit", "number", "Max related entries (default: 5)")
        prop("refresh", "boolean", "Force recompute (default: false)")
    }

    private fun memTags() = buildTool("mem_tags",
        "Manage tag taxonomy: create tags, tag/untag entries, search by tags, view taxonomy.") {
        prop("action", "string", "Action: create, tag, untag, search, taxonomy, popular, entry_tags")
        prop("tag", "string", "Tag name (for create)")
        prop("tags", "string", "Comma-separated tags (for tag/untag/search)")
        prop("entry_id", "number", "Entry ID (for tag/untag/entry_tags)")
        prop("category", "string", "Tag category (for create/taxonomy)")
        prop("parent_tag", "string", "Parent tag (for hierarchical create)")
        prop("operator", "string", "Search operator: AND, OR (default: AND)")
        prop("limit", "number", "Max results")
    }

    private fun memAnalytics() = buildTool("mem_analytics",
        "Search analytics: popular queries, zero-result queries, content gaps.") {
        prop("action", "string", "Action: summary, popular, gaps, zero_results")
        prop("limit", "number", "Max results (default: 10)")
    }

    private fun memCite() = buildToolRequired("mem_cite",
        "Record a citation when an entry is used/referenced.", listOf("entry_id", "cited_by")) {
        prop("entry_id", "number", "Entry ID being cited")
        prop("cited_by", "string", "Who/what is citing (agent name, user ID)")
        prop("context", "string", "Context of the citation")
    }

    private fun memCitations() = buildTool("mem_citations",
        "View citation data: citations for an entry, most cited, uncited entries.") {
        prop("action", "string", "Action: entry, most_cited, uncited, by_agent")
        prop("entry_id", "number", "Entry ID (for entry action)")
        prop("agent", "string", "Agent name (for by_agent action)")
        prop("limit", "number", "Max results (default: 10)")
    }

    private fun memFeedback() = buildTool("mem_feedback",
        "Submit and view feedback (thumbs up/down) for knowledge entries.") {
        prop("action", "string", "Action: submit, summary, low_rated, top_rated")
        prop("entry_id", "number", "Entry ID")
        prop("rating", "number", "Rating: 1 (thumbs up) or -1 (thumbs down)")
        prop("comment", "string", "Optional feedback comment")
        prop("limit", "number", "Max results (default: 10)")
    }

    private fun memReminders() = buildTool("mem_reminders",
        "Manage scheduled review reminders: list due, schedule, snooze, dismiss, complete.") {
        prop("action", "string", "Action: due, schedule, snooze, dismiss, complete, auto_schedule, stats")
        prop("entry_id", "number", "Entry ID")
        prop("interval_days", "number", "Review interval in days")
        prop("snooze_days", "number", "Snooze duration in days (default: 7)")
        prop("assignee", "string", "Assignee for the reminder")
        prop("reviewer", "string", "Reviewer who completed review")
        prop("limit", "number", "Max results (default: 20)")
    }

    private fun memQuality() = buildTool("mem_quality",
        "Score and validate content quality.") {
        prop("action", "string", "Action: score, score_all, low_quality, stats, validate")
        prop("entry_id", "number", "Entry ID to score")
        prop("content", "string", "Content to validate (for pre-ingest check)")
        prop("type", "string", "Entry type (for validate action)")
        prop("threshold", "number", "Quality threshold (default: 40)")
        prop("limit", "number", "Max results (default: 20)")
    }

    private fun memConfidence() = buildTool("mem_confidence",
        "Compute and query confidence scores for search results.") {
        prop("action", "string", "Action: compute, batch, unreliable, stats")
        prop("entry_id", "number", "Entry ID to compute confidence for")
        prop("limit", "number", "Max results (default: 20)")
    }

    private fun memDashboard() = buildTool("mem_dashboard",
        "KB health dashboard with metrics, recommendations, and trends.") {
        prop("action", "string", "Action: full, metrics, recommendations, trends")
        prop("days", "number", "Trend period in days (default: 30)")
    }

    // --- Builder helpers ---

    private class SchemaBuilder {
        val props = mutableMapOf<String, JsonObject>()
        fun prop(name: String, type: String, desc: String) {
            props[name] = buildJsonObject { put("type", type); put("description", desc) }
        }
    }

    private fun buildTool(name: String, desc: String, block: SchemaBuilder.() -> Unit): JsonObject {
        val builder = SchemaBuilder().apply(block)
        return buildJsonObject {
            put("name", name); put("description", desc)
            putJsonObject("inputSchema") {
                put("type", "object")
                putJsonObject("properties") { builder.props.forEach { (k, v) -> put(k, v) } }
            }
        }
    }

    private fun buildToolRequired(name: String, desc: String, required: List<String>, block: SchemaBuilder.() -> Unit): JsonObject {
        val builder = SchemaBuilder().apply(block)
        return buildJsonObject {
            put("name", name); put("description", desc)
            putJsonObject("inputSchema") {
                put("type", "object")
                putJsonObject("properties") { builder.props.forEach { (k, v) -> put(k, v) } }
                putJsonArray("required") { required.forEach { add(it) } }
            }
        }
    }
}
