"use strict";
/**
 * KSA-79: Citation Tracking & Source Attribution.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CitationTracker = void 0;
class CitationTracker {
    db;
    constructor(db) {
        this.db = db;
    }
    executeCite(args) {
        const entryId = args.entry_id;
        const citedBy = args.cited_by ?? '';
        if (!entryId || !citedBy)
            return 'Error: entry_id and cited_by required';
        const context = args.context ?? null;
        this.db.prepare('INSERT INTO citations (entry_id, cited_by, context) VALUES (?, ?, ?)').run(entryId, citedBy, context);
        return JSON.stringify({ entry_id: entryId, cited_by: citedBy, status: 'recorded' });
    }
    execute(args) {
        const action = args.action ?? 'most_cited';
        const limit = args.limit ?? 10;
        switch (action) {
            case 'entry': return this.getCitationsForEntry(args, limit);
            case 'uncited': return JSON.stringify(this.getUncited(limit), null, 2);
            case 'by_agent': return this.getCitationsByAgent(args, limit);
            default: return JSON.stringify(this.getMostCited(limit), null, 2);
        }
    }
    getCitationsForEntry(args, limit) {
        const entryId = args.entry_id;
        if (!entryId)
            return 'Error: entry_id required';
        const rows = this.db.prepare('SELECT cited_by, context, cited_at FROM citations WHERE entry_id = ? ORDER BY cited_at DESC LIMIT ?').all(entryId, limit);
        return JSON.stringify(rows, null, 2);
    }
    getMostCited(limit) {
        return this.db.prepare('SELECT c.entry_id, ke.summary, ke.type, COUNT(*) as citation_count FROM citations c JOIN knowledge_entries ke ON c.entry_id = ke.id GROUP BY c.entry_id ORDER BY citation_count DESC LIMIT ?').all(limit);
    }
    getUncited(limit) {
        return this.db.prepare('SELECT ke.id, ke.summary, ke.type, ke.tier FROM knowledge_entries ke LEFT JOIN citations c ON ke.id = c.entry_id WHERE c.id IS NULL AND ke.archived_at IS NULL ORDER BY ke.access_count DESC LIMIT ?').all(limit);
    }
    getCitationsByAgent(args, limit) {
        const agent = args.agent ?? '';
        if (!agent)
            return 'Error: agent required';
        const rows = this.db.prepare('SELECT c.entry_id, ke.summary, c.context, c.cited_at FROM citations c JOIN knowledge_entries ke ON c.entry_id = ke.id WHERE c.cited_by = ? ORDER BY c.cited_at DESC LIMIT ?').all(agent, limit);
        return JSON.stringify(rows, null, 2);
    }
}
exports.CitationTracker = CitationTracker;
//# sourceMappingURL=citation-tracker.js.map