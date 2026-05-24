"use strict";
/**
 * MemoryToolDispatcherV2 — routes V2 mem_* tool calls to handlers.
 * Handles 17 KB Enhancement tools (KSA-68).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryToolDispatcherV2 = void 0;
const consolidation_engine_v2_js_1 = require("./v2/consolidation-engine-v2.js");
const staleness_detector_js_1 = require("./v2/staleness-detector.js");
const template_manager_js_1 = require("./v2/template-manager.js");
const attachment_manager_js_1 = require("./v2/attachment-manager.js");
const suggestion_engine_js_1 = require("./v2/suggestion-engine.js");
const tag_taxonomy_js_1 = require("./v2/tag-taxonomy.js");
const search_analytics_js_1 = require("./v2/search-analytics.js");
const citation_tracker_js_1 = require("./v2/citation-tracker.js");
const feedback_manager_js_1 = require("./v2/feedback-manager.js");
const reminder_manager_js_1 = require("./v2/reminder-manager.js");
const quality_scorer_js_1 = require("./v2/quality-scorer.js");
const confidence_scorer_js_1 = require("./v2/confidence-scorer.js");
const health_dashboard_js_1 = require("./v2/health-dashboard.js");
class MemoryToolDispatcherV2 {
    consolidation;
    staleness;
    templates;
    attachments;
    suggestions;
    tags;
    analytics;
    citations;
    feedback;
    reminders;
    quality;
    confidence;
    dashboard;
    constructor(db) {
        this.consolidation = new consolidation_engine_v2_js_1.ConsolidationEngineV2(db);
        this.staleness = new staleness_detector_js_1.StalenessDetector(db);
        this.templates = new template_manager_js_1.TemplateManager(db);
        this.attachments = new attachment_manager_js_1.AttachmentManager(db);
        this.suggestions = new suggestion_engine_js_1.SuggestionEngine(db);
        this.tags = new tag_taxonomy_js_1.TagTaxonomy(db);
        this.analytics = new search_analytics_js_1.SearchAnalytics(db);
        this.citations = new citation_tracker_js_1.CitationTracker(db);
        this.feedback = new feedback_manager_js_1.FeedbackManager(db);
        this.reminders = new reminder_manager_js_1.ReminderManager(db);
        this.quality = new quality_scorer_js_1.QualityScorer(db);
        this.confidence = new confidence_scorer_js_1.ConfidenceScorer(db);
        this.dashboard = new health_dashboard_js_1.HealthDashboard(db);
    }
    /** Dispatch a V2 memory tool call. Returns null if not handled. */
    dispatch(name, args) {
        switch (name) {
            case 'mem_consolidate_v2': return this.consolidation.execute(args);
            case 'mem_stale': return this.staleness.execute(args);
            case 'mem_due_reviews': return this.staleness.executeDueReviews(args);
            case 'mem_review': return this.staleness.executeReview(args);
            case 'mem_templates': return this.templates.execute(args);
            case 'mem_attachments': return this.attachments.execute(args);
            case 'mem_suggest': return this.suggestions.execute(args);
            case 'mem_related': return this.suggestions.executeRelated(args);
            case 'mem_tags': return this.tags.execute(args);
            case 'mem_analytics': return this.analytics.execute(args);
            case 'mem_cite': return this.citations.executeCite(args);
            case 'mem_citations': return this.citations.execute(args);
            case 'mem_feedback': return this.feedback.execute(args);
            case 'mem_reminders': return this.reminders.execute(args);
            case 'mem_quality': return this.quality.execute(args);
            case 'mem_confidence': return this.confidence.execute(args);
            case 'mem_dashboard': return this.dashboard.execute(args);
            default: return null;
        }
    }
}
exports.MemoryToolDispatcherV2 = MemoryToolDispatcherV2;
//# sourceMappingURL=tool-dispatcher-v2.js.map