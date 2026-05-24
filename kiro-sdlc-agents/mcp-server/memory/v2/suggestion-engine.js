"use strict";
/**
 * KSA-76: Auto-Suggestions & Related Entries.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuggestionEngine = void 0;
class SuggestionEngine {
    db;
    constructor(db) {
        this.db = db;
    }
    execute(args) {
        const query = args.query ?? '';
        const limit = args.limit ?? 5;
        if (!query || query.length < 2)
            return 'Error: query must be at least 2 characters';
        const results = this.suggest(query, limit);
        if (!results.length)
            return `No suggestions for "${query}"`;
        const lines = [`Suggestions (${results.length}):\n`];
        for (const r of results)
            lines.push(`  #${r.id} [${r.type}] ${(r.summary ?? '').slice(0, 60)}`);
        return lines.join('\n');
    }
    executeRelated(args) {
        const entryId = args.entry_id;
        if (!entryId)
            return 'Error: entry_id required';
        const limit = args.limit ?? 5;
        const refresh = args.refresh ?? false;
        const results = refresh ? this.refreshRelated(entryId, limit) : this.getRelated(entryId, limit);
        if (!results.length)
            return `No related entries found for #${entryId}`;
        const lines = [`Related to #${entryId} (${results.length}):\n`];
        for (const r of results)
            lines.push(`  #${r.id} [${r.type}] ${(r.summary ?? '').slice(0, 60)} (score: ${r.score})`);
        return lines.join('\n');
    }
    suggest(query, limit) {
        try {
            return this.db.prepare(`SELECT ke.id, ke.summary, ke.type, ke.tier FROM knowledge_fts JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id WHERE knowledge_fts MATCH ? AND ke.archived_at IS NULL ORDER BY ke.access_count DESC LIMIT ?`).all(`${query}*`, limit);
        }
        catch {
            return this.fallbackSuggest(query, limit);
        }
    }
    fallbackSuggest(query, limit) {
        return this.db.prepare('SELECT id, summary, type, tier FROM knowledge_entries WHERE summary LIKE ? AND archived_at IS NULL ORDER BY access_count DESC LIMIT ?').all(`%${query}%`, limit);
    }
    getRelated(entryId, limit) {
        const cached = this.getCachedRelated(entryId, limit);
        if (cached.length)
            return cached;
        return this.refreshRelated(entryId, limit);
    }
    refreshRelated(entryId, limit) {
        this.db.prepare('DELETE FROM related_entries_cache WHERE entry_id = ?').run(entryId);
        const related = this.computeRelated(entryId, limit);
        const stmt = this.db.prepare('INSERT OR REPLACE INTO related_entries_cache (entry_id, related_id, score, method) VALUES (?, ?, ?, ?)');
        for (const r of related)
            stmt.run(entryId, r.id, r.score, 'hybrid');
        return related;
    }
    computeRelated(entryId, limit) {
        const entry = this.db.prepare('SELECT * FROM knowledge_entries WHERE id = ?').get(entryId);
        if (!entry)
            return [];
        const scores = new Map();
        this.scoreByTags(entry, scores);
        this.scoreByGraph(entryId, scores);
        this.scoreByFts(entry, scores);
        scores.delete(entryId);
        const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
        return sorted.map(([id, score]) => {
            const r = this.db.prepare('SELECT id, summary, type, tier FROM knowledge_entries WHERE id = ?').get(id);
            return r ? { ...r, score: Math.round(score * 1000) / 1000 } : null;
        }).filter(Boolean);
    }
    scoreByTags(entry, scores) {
        const tags = (entry.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean);
        if (!tags.length)
            return;
        const conditions = tags.map(() => 'tags LIKE ?').join(' OR ');
        const params = [entry.id, ...tags.map((t) => `%${t}%`)];
        try {
            const rows = this.db.prepare(`SELECT id FROM knowledge_entries WHERE id != ? AND archived_at IS NULL AND (${conditions})`).all(...params);
            for (const r of rows)
                scores.set(r.id, (scores.get(r.id) ?? 0) + 0.4);
        }
        catch { /* skip on error */ }
    }
    scoreByGraph(entryId, scores) {
        try {
            const rows = this.db.prepare('SELECT target_id as nid FROM knowledge_graph_edges WHERE source_id = ? UNION SELECT source_id as nid FROM knowledge_graph_edges WHERE target_id = ?').all(entryId, entryId);
            for (const r of rows)
                scores.set(r.nid, (scores.get(r.nid) ?? 0) + 0.3);
        }
        catch { /* graph table may not exist */ }
    }
    scoreByFts(entry, scores) {
        const words = (entry.summary ?? '').split(/\s+/).filter((w) => w.length > 3).slice(0, 5);
        if (!words.length)
            return;
        const query = words.join(' OR ');
        try {
            const rows = this.db.prepare('SELECT ke.id FROM knowledge_fts JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id WHERE knowledge_fts MATCH ? AND ke.id != ? AND ke.archived_at IS NULL LIMIT 10').all(query, entry.id);
            for (const r of rows)
                scores.set(r.id, (scores.get(r.id) ?? 0) + 0.3);
        }
        catch { /* FTS may fail */ }
    }
    getCachedRelated(entryId, limit) {
        try {
            return this.db.prepare('SELECT rc.related_id as id, rc.score, ke.summary, ke.type, ke.tier FROM related_entries_cache rc JOIN knowledge_entries ke ON rc.related_id = ke.id WHERE rc.entry_id = ? ORDER BY rc.score DESC LIMIT ?').all(entryId, limit);
        }
        catch {
            return [];
        }
    }
}
exports.SuggestionEngine = SuggestionEngine;
//# sourceMappingURL=suggestion-engine.js.map