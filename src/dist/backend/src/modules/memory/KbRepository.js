/**
 * KbRepository — CRUD operations for multi-tier kb_entries table.
 * Implements TDD §4.2 kb_entries, §4.4 Key Query Patterns.
 */
import { createHash, randomUUID } from 'node:crypto';
export class KbRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    create(entry) {
        const id = randomUUID();
        const contentHash = createHash('sha256').update(entry.content).digest('hex');
        const tags = JSON.stringify(entry.tags ?? []);
        this.db.prepare(`
      INSERT INTO kb_entries (id, tier, owner_id, project_id, title, content, content_hash, tags, quality_score, ttl_days, promoted_from, promoted_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, entry.tier, entry.owner_id, entry.project_id ?? null, entry.title ?? null, entry.content, contentHash, tags, entry.quality_score ?? 0.0, entry.ttl_days ?? null, entry.promoted_from ?? null, entry.promoted_by ?? null);
        return this.findById(id);
    }
    findById(id) {
        const stmt = this.db.prepare('SELECT * FROM kb_entries WHERE id = ?');
        const row = stmt.get(id);
        return row ?? null;
    }
    findUserEntries(userId, limit = 100) {
        const stmt = this.db.prepare('SELECT * FROM kb_entries WHERE tier = 1 AND owner_id = ? ORDER BY created_at DESC LIMIT ?');
        return stmt.all(userId, limit);
    }
    findProjectEntries(projectIds, limit = 100) {
        if (projectIds.length === 0)
            return [];
        const placeholders = projectIds.map(() => '?').join(',');
        const stmt = this.db.prepare(`SELECT * FROM kb_entries WHERE tier = 2 AND project_id IN (${placeholders}) ORDER BY created_at DESC LIMIT ?`);
        return stmt.all(...projectIds, limit);
    }
    findSharedEntries(limit = 100) {
        const stmt = this.db.prepare('SELECT * FROM kb_entries WHERE tier = 3 ORDER BY created_at DESC LIMIT ?');
        return stmt.all(limit);
    }
    findPromotionCandidates(tier, qualityThreshold = 0.8) {
        const stmt = this.db.prepare('SELECT * FROM kb_entries WHERE tier = ? AND promoted = 0 AND quality_score > ?');
        return stmt.all(tier, qualityThreshold);
    }
    markPromoted(entryId) {
        this.db.prepare("UPDATE kb_entries SET promoted = 1, updated_at = datetime('now') WHERE id = ?").run(entryId);
    }
    deleteExpiredEntries() {
        const result = this.db.prepare(`
      DELETE FROM kb_entries
      WHERE tier = 1 AND ttl_days IS NOT NULL
      AND datetime(created_at, '+' || ttl_days || ' days') < datetime('now')
    `).run();
        return result.changes;
    }
    countUserEntries(userId) {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM kb_entries WHERE tier = 1 AND owner_id = ?');
        const row = stmt.get(userId);
        return row.count;
    }
    countProjectEntries(projectId) {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM kb_entries WHERE tier = 2 AND project_id = ?');
        const row = stmt.get(projectId);
        return row.count;
    }
    countSharedEntries() {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM kb_entries WHERE tier = 3');
        const row = stmt.get();
        return row.count;
    }
    findByContentHash(hash) {
        const stmt = this.db.prepare('SELECT * FROM kb_entries WHERE content_hash = ?');
        return stmt.all(hash);
    }
}
//# sourceMappingURL=KbRepository.js.map