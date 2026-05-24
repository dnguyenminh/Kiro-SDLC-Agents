"use strict";
/**
 * WorkingTierExpiry — lazy auto-expiry of stale WORKING tier entries.
 * Runs on every mem_search call (no background threads).
 * Entries older than expiryHours are promoted (quality ≥ 60) or archived.
 * Pinned entries are exempt from expiry (BR-F1-05).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkingTierExpiry = void 0;
class WorkingTierExpiry {
    db;
    expiryHours;
    promoteThreshold;
    constructor(db, options) {
        this.db = db;
        this.expiryHours = options?.expiryHours ?? 24;
        this.promoteThreshold = options?.promoteThreshold ?? 60;
    }
    /** Process stale WORKING entries. Returns actions taken. */
    processStale() {
        const stale = this.getStaleEntries();
        if (stale.length === 0)
            return [];
        const actions = [];
        const promoteStmt = this.db.prepare(`UPDATE knowledge_entries SET tier = 'EPISODIC', updated_at = datetime('now')
       WHERE id = ?`);
        const archiveStmt = this.db.prepare(`UPDATE knowledge_entries SET archived = 1, updated_at = datetime('now')
       WHERE id = ?`);
        const tx = this.db.transaction(() => {
            for (const entry of stale) {
                const score = entry.quality_score ?? 0;
                if (score >= this.promoteThreshold) {
                    promoteStmt.run(entry.id);
                    actions.push({
                        entry_id: entry.id,
                        action: 'promoted',
                        quality_score: score,
                        to_tier: 'EPISODIC',
                    });
                }
                else {
                    archiveStmt.run(entry.id);
                    actions.push({
                        entry_id: entry.id,
                        action: 'archived',
                        quality_score: score,
                    });
                }
            }
        });
        tx();
        return actions;
    }
    /** Find WORKING entries older than expiryHours, excluding pinned. */
    getStaleEntries() {
        const cutoff = new Date(Date.now() - this.expiryHours * 3600_000).toISOString();
        return this.db.prepare(`
      SELECT id, quality_score FROM knowledge_entries
      WHERE tier = 'WORKING'
        AND archived = 0
        AND pinned = 0
        AND created_at < ?
      ORDER BY created_at ASC
      LIMIT 100
    `).all(cutoff);
    }
}
exports.WorkingTierExpiry = WorkingTierExpiry;
//# sourceMappingURL=working-tier-expiry.js.map