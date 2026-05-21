/**
 * MemoryToolDispatcherV2 — routes V2 mem_* tool calls to handlers.
 * Handles 17 KB Enhancement tools (KSA-68).
 */

import { ConsolidationEngineV2 } from './v2/consolidation-engine-v2.js';
import { StalenessDetector } from './v2/staleness-detector.js';
import { TemplateManager } from './v2/template-manager.js';
import { AttachmentManager } from './v2/attachment-manager.js';
import { SuggestionEngine } from './v2/suggestion-engine.js';
import { TagTaxonomy } from './v2/tag-taxonomy.js';
import { SearchAnalytics } from './v2/search-analytics.js';
import { CitationTracker } from './v2/citation-tracker.js';
import { FeedbackManager } from './v2/feedback-manager.js';
import { ReminderManager } from './v2/reminder-manager.js';
import { QualityScorer } from './v2/quality-scorer.js';
import { ConfidenceScorer } from './v2/confidence-scorer.js';
import { HealthDashboard } from './v2/health-dashboard.js';
import type Database from 'better-sqlite3';

export class MemoryToolDispatcherV2 {
  private readonly consolidation: ConsolidationEngineV2;
  private readonly staleness: StalenessDetector;
  private readonly templates: TemplateManager;
  private readonly attachments: AttachmentManager;
  private readonly suggestions: SuggestionEngine;
  private readonly tags: TagTaxonomy;
  private readonly analytics: SearchAnalytics;
  private readonly citations: CitationTracker;
  private readonly feedback: FeedbackManager;
  private readonly reminders: ReminderManager;
  private readonly quality: QualityScorer;
  private readonly confidence: ConfidenceScorer;
  private readonly dashboard: HealthDashboard;

  constructor(db: Database.Database) {
    this.consolidation = new ConsolidationEngineV2(db);
    this.staleness = new StalenessDetector(db);
    this.templates = new TemplateManager(db);
    this.attachments = new AttachmentManager(db);
    this.suggestions = new SuggestionEngine(db);
    this.tags = new TagTaxonomy(db);
    this.analytics = new SearchAnalytics(db);
    this.citations = new CitationTracker(db);
    this.feedback = new FeedbackManager(db);
    this.reminders = new ReminderManager(db);
    this.quality = new QualityScorer(db);
    this.confidence = new ConfidenceScorer(db);
    this.dashboard = new HealthDashboard(db);
  }

  /** Dispatch a V2 memory tool call. Returns null if not handled. */
  dispatch(name: string, args: Record<string, unknown>): string | null {
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
