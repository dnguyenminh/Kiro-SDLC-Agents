/**
 * V2 Memory Tools — KB Enhancement (KSA-68) + KB Upgrade v0.6.0 (KSA-110).
 * Re-exports all V2 handler classes.
 */

export { ConsolidationEngineV2 } from './consolidation-engine-v2.js';
export { StalenessDetector } from './staleness-detector.js';
export { TemplateManager } from './template-manager.js';
export { AttachmentManager } from './attachment-manager.js';
export { SuggestionEngine } from './suggestion-engine.js';
export { TagTaxonomy } from './tag-taxonomy.js';
export { SearchAnalytics } from './search-analytics.js';
export { CitationTracker } from './citation-tracker.js';
export { FeedbackManager } from './feedback-manager.js';
export { ReminderManager } from './reminder-manager.js';
export { QualityScorer } from './quality-scorer.js';
export { ConfidenceScorer } from './confidence-scorer.js';
export { HealthDashboard } from './health-dashboard.js';

// KSA-110: KB System Upgrade v0.6.0 — F4 Anti-Pattern Protection
export { QualityGate } from './quality-gate.js';
export { AgentScopeFilter } from './agent-scope-filter.js';
export { WorkingTierExpiry } from './working-tier-expiry.js';
export { TokenBudget } from './token-budget.js';
export { backfillStructuredMaps } from './backfill-script.js';
