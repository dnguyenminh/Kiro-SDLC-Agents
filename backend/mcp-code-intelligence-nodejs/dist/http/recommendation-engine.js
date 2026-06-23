"use strict";
/**
 * RecommendationEngine — generates prioritized KB improvement suggestions.
 * Port of Python recommendation_engine.py.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecommendationEngine = void 0;
class RecommendationEngine {
    db;
    constructor(db) {
        this.db = db;
    }
    getRecommendations(limit = 10) {
        const recs = [
            ...this.findStaleEntries(),
            ...this.findUntaggedEntries(),
            ...this.findLowQuality(),
            ...this.findOrphanEntries(),
        ];
        recs.sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity));
        return { recommendations: recs.slice(0, limit), total: recs.length };
    }
    findStaleEntries() {
        const threshold = new Date(Date.now() - 90 * 86400000).toISOString();
        try {
            const rows = this.db.prepare(`SELECT id, summary, type, updated_at FROM knowledge_entries
         WHERE updated_at < ? ORDER BY updated_at ASC LIMIT 20`).all(threshold);
            return rows.map(r => buildStaleRec(r));
        }
        catch {
            return [];
        }
    }
    findUntaggedEntries() {
        try {
            const rows = this.db.prepare(`SELECT id, summary, type FROM knowledge_entries
         WHERE (tags IS NULL OR tags = '') ORDER BY created_at DESC LIMIT 15`).all();
            return rows.map(r => buildUntagRec(r));
        }
        catch {
            return [];
        }
    }
    findLowQuality() {
        try {
            const rows = this.db.prepare(`SELECT e.id, e.summary, e.type, qs.total_score as quality_score
         FROM quality_scores qs JOIN knowledge_entries e ON qs.entry_id = e.id
         WHERE qs.total_score < 40 ORDER BY qs.total_score ASC LIMIT 10`).all();
            return rows.map(r => buildQualityRec(r));
        }
        catch {
            return [];
        }
    }
    findOrphanEntries() {
        try {
            const rows = this.db.prepare(`SELECT e.id, e.summary, e.type FROM knowledge_entries e
         WHERE e.id NOT IN (
           SELECT source_id FROM knowledge_graph_edges
           UNION SELECT target_id FROM knowledge_graph_edges
         ) ORDER BY e.created_at DESC LIMIT 10`).all();
            return rows.map(r => buildOrphanRec(r));
        }
        catch {
            return [];
        }
    }
}
exports.RecommendationEngine = RecommendationEngine;
function buildStaleRec(r) {
    return {
        id: `rec-stale-${r.id}`, type: 'stale', severity: 'high',
        title: `Entry #${r.id} chưa review > 90 ngày`,
        description: `[${r.type}] ${(r.summary ?? '').substring(0, 80)}`,
        entry_id: r.id,
        action: { label: 'Mark Reviewed', endpoint: `api/kb/entries/${r.id}/review`, method: 'POST', confirm: false },
    };
}
function buildUntagRec(r) {
    return {
        id: `rec-untag-${r.id}`, type: 'untagged', severity: 'medium',
        title: `Entry #${r.id} chưa có tags`,
        description: `[${r.type}] ${(r.summary ?? '').substring(0, 80)}`,
        entry_id: r.id,
        action: { label: 'Auto-Tag', endpoint: `api/kb/entries/${r.id}/auto-tag`, method: 'POST', confirm: false },
    };
}
function buildQualityRec(r) {
    return {
        id: `rec-quality-${r.id}`, type: 'low_quality', severity: 'medium',
        title: `Entry #${r.id} quality score thấp (${r.quality_score ?? 0})`,
        description: `[${r.type}] ${(r.summary ?? '').substring(0, 80)}`,
        entry_id: r.id, action: null,
    };
}
function buildOrphanRec(r) {
    return {
        id: `rec-orphan-${r.id}`, type: 'orphan', severity: 'low',
        title: `Entry #${r.id} không có relationships`,
        description: `[${r.type}] ${(r.summary ?? '').substring(0, 80)}`,
        entry_id: r.id,
        action: { label: 'Find Related', endpoint: `api/kb/entries/${r.id}/find-related`, method: 'POST', confirm: false },
    };
}
function severityOrder(severity) {
    return { high: 0, medium: 1, low: 2 }[severity] ?? 3;
}
//# sourceMappingURL=recommendation-engine.js.map