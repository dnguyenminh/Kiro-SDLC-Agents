"use strict";
/**
 * FtsStrategy — full-text search fallback linking.
 * KSA-190: Auto-Linking Logic on KB Ingest.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FtsStrategy = void 0;
class FtsStrategy {
    name = 'fts';
    db;
    constructor(db) {
        this.db = db;
    }
    isEnabled(config) {
        return config.fts.enabled;
    }
    findCandidates(entryId, config) {
        // Get entry summary for keyword extraction
        const entry = this.db.prepare('SELECT summary FROM knowledge_entries WHERE id = ?').get(entryId);
        if (!entry || !entry.summary)
            return [];
        // Extract significant words (> 3 chars, not common stopwords)
        const stopwords = new Set([
            'this', 'that', 'with', 'from', 'have', 'been', 'will', 'would',
            'could', 'should', 'their', 'there', 'where', 'when', 'what',
            'which', 'about', 'into', 'more', 'some', 'than', 'them', 'then',
            'these', 'they', 'were', 'your',
        ]);
        const words = entry.summary
            .split(/\s+/)
            .map(w => w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
            .filter(w => w.length > 3 && !stopwords.has(w))
            .slice(0, 5);
        if (words.length === 0)
            return [];
        const query = words.join(' OR ');
        try {
            const rows = this.db.prepare(`SELECT ke.id, rank FROM knowledge_fts
         JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id
         WHERE knowledge_fts MATCH ? AND ke.id != ? AND ke.archived = 0
         ORDER BY rank LIMIT 10`).all(query, entryId);
            if (rows.length === 0)
                return [];
            const candidates = [];
            const maxRank = Math.abs(rows[0].rank) || 1;
            for (const row of rows) {
                const normalizedScore = Math.min(1.0, Math.abs(row.rank) / maxRank);
                candidates.push({
                    targetId: row.id,
                    relation: 'TOPIC_OVERLAP',
                    score: normalizedScore,
                    metadata: { query_words: words, fts_rank: row.rank },
                });
            }
            return candidates.slice(0, config.fts.maxEdges);
        }
        catch {
            return []; // FTS may fail on malformed queries
        }
    }
}
exports.FtsStrategy = FtsStrategy;
//# sourceMappingURL=fts-strategy.js.map