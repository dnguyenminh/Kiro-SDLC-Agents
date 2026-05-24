"use strict";
/**
 * KSA-80: Confidence Scoring for Search Results.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfidenceScorer = void 0;
const CONFIDENCE_WEIGHTS = { quality: 0.3, citations: 0.25, feedback: 0.25, freshness: 0.2 };
class ConfidenceScorer {
    db;
    constructor(db) {
        this.db = db;
    }
    execute(args) {
        const action = args.action ?? 'stats';
        switch (action) {
            case 'compute': return this.computeConfidence(args);
            case 'batch': return JSON.stringify(this.batchCompute(args));
            case 'unreliable': return JSON.stringify(this.getUnreliable(args), null, 2);
            default: return JSON.stringify(this.getStats(), null, 2);
        }
    }
    computeConfidence(args) {
        const entryId = args.entry_id;
        if (!entryId)
            return 'Error: entry_id required';
        const entry = this.db.prepare('SELECT * FROM knowledge_entries WHERE id = ?').get(entryId);
        if (!entry)
            return `Error: entry ${entryId} not found`;
        const qualityScore = this.getQualitySignal(entryId);
        const citationScore = this.getCitationSignal(entryId);
        const feedbackScore = this.getFeedbackSignal(entryId);
        const freshnessScore = this.getFreshnessSignal(entry);
        const confidence = CONFIDENCE_WEIGHTS.quality * qualityScore
            + CONFIDENCE_WEIGHTS.citations * citationScore
            + CONFIDENCE_WEIGHTS.feedback * feedbackScore
            + CONFIDENCE_WEIGHTS.freshness * freshnessScore;
        const normalized = Math.min(Math.max(confidence / 100, 0), 1);
        this.db.prepare("UPDATE knowledge_entries SET confidence = ?, updated_at = datetime('now') WHERE id = ?").run(normalized, entryId);
        return JSON.stringify({ entry_id: entryId, confidence: Math.round(normalized * 1000) / 1000, signals: { quality: qualityScore, citations: citationScore, feedback: feedbackScore, freshness: freshnessScore } }, null, 2);
    }
    batchCompute(args) {
        const limit = args.limit ?? 200;
        const rows = this.db.prepare('SELECT id FROM knowledge_entries WHERE archived_at IS NULL LIMIT ?').all(limit);
        let computed = 0;
        for (const row of rows) {
            this.computeConfidence({ entry_id: row.id });
            computed++;
        }
        return { computed, total: rows.length };
    }
    getUnreliable(args) {
        const limit = args.limit ?? 20;
        return this.db.prepare('SELECT id, summary, type, confidence, feedback_score FROM knowledge_entries WHERE confidence < 0.4 AND archived_at IS NULL ORDER BY confidence ASC LIMIT ?').all(limit);
    }
    getStats() {
        const avg = this.db.prepare('SELECT AVG(confidence) as avg FROM knowledge_entries WHERE archived_at IS NULL').get();
        const low = this.db.prepare('SELECT COUNT(*) as cnt FROM knowledge_entries WHERE confidence < 0.4 AND archived_at IS NULL').get();
        const high = this.db.prepare('SELECT COUNT(*) as cnt FROM knowledge_entries WHERE confidence >= 0.8 AND archived_at IS NULL').get();
        return { avg_confidence: Math.round((avg.avg ?? 0) * 1000) / 1000, low_confidence_count: low.cnt, high_confidence_count: high.cnt };
    }
    getQualitySignal(entryId) {
        const row = this.db.prepare('SELECT total_score FROM quality_scores WHERE entry_id = ?').get(entryId);
        return row?.total_score ?? 50;
    }
    getCitationSignal(entryId) {
        const row = this.db.prepare('SELECT COUNT(*) as cnt FROM citations WHERE entry_id = ?').get(entryId);
        const count = row?.cnt ?? 0;
        if (count >= 10)
            return 100;
        if (count >= 5)
            return 80;
        if (count >= 2)
            return 60;
        if (count >= 1)
            return 40;
        return 20;
    }
    getFeedbackSignal(entryId) {
        const row = this.db.prepare('SELECT feedback_score FROM knowledge_entries WHERE id = ?').get(entryId);
        const score = row?.feedback_score ?? 0;
        if (score >= 5)
            return 100;
        if (score >= 2)
            return 80;
        if (score >= 0)
            return 60;
        if (score >= -2)
            return 40;
        return 20;
    }
    getFreshnessSignal(entry) {
        if (!entry.updated_at)
            return 30;
        const days = (Date.now() - new Date(entry.updated_at).getTime()) / 86400000;
        if (days < 7)
            return 100;
        if (days < 30)
            return 80;
        if (days < 90)
            return 60;
        return 30;
    }
}
exports.ConfidenceScorer = ConfidenceScorer;
//# sourceMappingURL=confidence-scorer.js.map