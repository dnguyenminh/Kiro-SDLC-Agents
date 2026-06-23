"use strict";
/**
 * KSA-81: Feedback Loop (Thumbs Up/Down).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedbackManager = void 0;
class FeedbackManager {
    db;
    constructor(db) {
        this.db = db;
    }
    execute(args) {
        const action = args.action ?? 'summary';
        switch (action) {
            case 'submit': return this.submitFeedback(args);
            case 'low_rated': return JSON.stringify(this.getLowRated(args), null, 2);
            case 'top_rated': return JSON.stringify(this.getTopRated(args), null, 2);
            default: return this.getSummary(args);
        }
    }
    submitFeedback(args) {
        const entryId = args.entry_id;
        const rating = args.rating;
        if (!entryId || rating === undefined)
            return 'Error: entry_id and rating required';
        if (rating !== 1 && rating !== -1)
            return 'Error: rating must be 1 or -1';
        const comment = args.comment ?? null;
        this.db.prepare('INSERT INTO entry_feedback (entry_id, rating, comment) VALUES (?, ?, ?)').run(entryId, rating, comment);
        this.updateFeedbackScore(entryId);
        return JSON.stringify({ entry_id: entryId, rating, status: 'recorded' });
    }
    getSummary(args) {
        const entryId = args.entry_id;
        if (!entryId)
            return 'Error: entry_id required for summary';
        const row = this.db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as positive, SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END) as negative FROM entry_feedback WHERE entry_id = ?').get(entryId);
        return JSON.stringify({ entry_id: entryId, total: row.total, positive: row.positive ?? 0, negative: row.negative ?? 0, score: (row.positive ?? 0) - (row.negative ?? 0) });
    }
    getLowRated(args) {
        const limit = args.limit ?? 10;
        return this.db.prepare('SELECT ke.id, ke.summary, ke.type, ke.feedback_score FROM knowledge_entries ke WHERE ke.feedback_score < 0 AND ke.archived_at IS NULL ORDER BY ke.feedback_score ASC LIMIT ?').all(limit);
    }
    getTopRated(args) {
        const limit = args.limit ?? 10;
        return this.db.prepare('SELECT ke.id, ke.summary, ke.type, ke.feedback_score FROM knowledge_entries ke WHERE ke.feedback_score > 0 AND ke.archived_at IS NULL ORDER BY ke.feedback_score DESC LIMIT ?').all(limit);
    }
    updateFeedbackScore(entryId) {
        const row = this.db.prepare('SELECT SUM(rating) as score FROM entry_feedback WHERE entry_id = ?').get(entryId);
        this.db.prepare('UPDATE knowledge_entries SET feedback_score = ? WHERE id = ?').run(row.score ?? 0, entryId);
    }
}
exports.FeedbackManager = FeedbackManager;
//# sourceMappingURL=feedback-manager.js.map