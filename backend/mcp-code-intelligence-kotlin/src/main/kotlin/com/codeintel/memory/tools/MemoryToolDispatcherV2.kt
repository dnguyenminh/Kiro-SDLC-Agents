/** Dispatches V2 memory tool calls to KB Enhancement handlers. */
package com.codeintel.memory.tools

import com.codeintel.memory.tools.v2.*
import kotlinx.serialization.json.JsonObject
import java.sql.Connection

class MemoryToolDispatcherV2(private val conn: Connection) {

    private val consolidation = KbConsolidateV2Tool(conn)
    private val staleness = KbStaleTool(conn)
    private val templates = KbTemplatesTool(conn)
    private val attachments = KbAttachmentsTool(conn)
    private val suggestions = KbSuggestTool(conn)
    private val tags = KbTagsTool(conn)
    private val analytics = KbAnalyticsTool(conn)
    private val citations = KbCitationsTool(conn)
    private val feedback = KbFeedbackTool(conn)
    private val reminders = KbRemindersTool(conn)
    private val quality = KbQualityTool(conn)
    private val confidence = KbConfidenceTool(conn)
    private val dashboard = KbDashboardTool(conn)

    /** Dispatch a V2 memory tool call. Returns null if not handled. */
    fun dispatch(name: String, args: JsonObject): String? {
        return when (name) {
            "mem_consolidate_v2" -> consolidation.execute(args)
            "mem_stale" -> staleness.execute(args)
            "mem_due_reviews" -> staleness.executeDueReviews(args)
            "mem_review" -> staleness.executeReview(args)
            "mem_templates" -> templates.execute(args)
            "mem_attachments" -> attachments.execute(args)
            "mem_suggest" -> suggestions.execute(args)
            "mem_related" -> suggestions.executeRelated(args)
            "mem_tags" -> tags.execute(args)
            "mem_analytics" -> analytics.execute(args)
            "mem_cite" -> citations.executeCite(args)
            "mem_citations" -> citations.execute(args)
            "mem_feedback" -> feedback.execute(args)
            "mem_reminders" -> reminders.execute(args)
            "mem_quality" -> quality.execute(args)
            "mem_confidence" -> confidence.execute(args)
            "mem_dashboard" -> dashboard.execute(args)
            else -> null
        }
    }
}
