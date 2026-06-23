"use strict";
/**
 * ConsolidationRepository — tier transition logging and statistics.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsolidationRepository = void 0;
class ConsolidationRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    /** Log a tier transition. */
    logTransition(entryId, fromTier, toTier, reason) {
        this.db.prepare(`
      INSERT INTO consolidation_log (entry_id, from_tier, to_tier, reason)
      VALUES (?, ?, ?, ?)
    `).run(entryId, fromTier, toTier, reason);
    }
    /** Get tier statistics (entry count, avg confidence, avg access). */
    getTierStats() {
        return this.db.prepare(`
      SELECT tier, COUNT(*) as entryCount,
             AVG(confidence) as avgConfidence,
             AVG(access_count) as avgAccessCount
      FROM knowledge_entries
      GROUP BY tier
    `).all();
    }
    /** Find entries eligible for promotion. */
    findPromotionCandidates(tier, minAccess, minConfidence) {
        const rows = this.db.prepare(`
      SELECT id FROM knowledge_entries
      WHERE tier = ? AND access_count >= ? AND confidence >= ?
      ORDER BY access_count DESC
    `).all(tier, minAccess, minConfidence);
        return rows.map(r => r.id);
    }
}
exports.ConsolidationRepository = ConsolidationRepository;
//# sourceMappingURL=consolidation-repo.js.map