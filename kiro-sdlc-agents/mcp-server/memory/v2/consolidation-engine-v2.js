"use strict";
/**
 * KSA-69: Real Consolidation Engine — Promote/Demote/Merge with dry-run.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsolidationEngineV2 = void 0;
const PROMOTION_THRESHOLDS = {
    'WORKING_TO_EPISODIC': { access: 3, confidence: 0.7 },
    'EPISODIC_TO_SEMANTIC': { access: 10, confidence: 0.85 },
    'SEMANTIC_TO_PROCEDURAL': { access: 25, confidence: 0.95 },
};
const DEMOTION_THRESHOLDS = {
    'PROCEDURAL_TO_SEMANTIC': { daysInactive: 90, minAccess: 25 },
    'SEMANTIC_TO_EPISODIC': { daysInactive: 60, minAccess: 10 },
    'EPISODIC_TO_WORKING': { daysInactive: 30, minAccess: 3 },
};
class ConsolidationEngineV2 {
    db;
    constructor(db) {
        this.db = db;
    }
    execute(args) {
        const action = args.action ?? 'consolidate';
        const dryRun = args.dry_run ?? false;
        if (action === 'merge')
            return this.handleMerge(args, dryRun);
        return this.handleConsolidate(dryRun);
    }
    handleConsolidate(dryRun) {
        const promoted = this.promoteEligible(dryRun);
        const demoted = this.demoteInactive(dryRun);
        const merged = this.mergeDuplicates(dryRun);
        return JSON.stringify({ promoted, demoted, merged, dry_run: dryRun }, null, 2);
    }
    handleMerge(args, dryRun) {
        const survivorId = args.survivor_id;
        const mergeIdsStr = args.merge_ids ?? '';
        if (!survivorId || !mergeIdsStr)
            return 'Error: survivor_id and merge_ids required';
        const mergeIds = mergeIdsStr.split(',').map(s => parseInt(s.trim(), 10));
        const strategy = args.strategy ?? 'append';
        return JSON.stringify(this.mergeEntries(survivorId, mergeIds, strategy, dryRun), null, 2);
    }
    mergeEntries(survivorId, mergeIds, strategy, dryRun) {
        const survivor = this.getEntry(survivorId);
        if (!survivor)
            return { error: `Survivor ${survivorId} not found` };
        const entries = mergeIds.map(id => this.getEntry(id)).filter(Boolean);
        if (!entries.length)
            return { error: 'No valid entries to merge' };
        if (dryRun)
            return { action: 'merge', survivor_id: survivorId, merge_count: entries.length, strategy, dry_run: true };
        const content = this.applyStrategy(survivor, entries, strategy);
        const totalAccess = survivor.access_count + entries.reduce((s, e) => s + e.access_count, 0);
        this.db.prepare('UPDATE knowledge_entries SET content = ?, access_count = ?, updated_at = datetime(\'now\') WHERE id = ?').run(content, totalAccess, survivorId);
        this.db.prepare('INSERT INTO merge_history (survivor_id, merged_ids, strategy) VALUES (?, ?, ?)').run(survivorId, JSON.stringify(mergeIds), strategy);
        for (const id of mergeIds)
            this.db.prepare('DELETE FROM knowledge_entries WHERE id = ?').run(id);
        return { survivor_id: survivorId, merged_count: entries.length, strategy, new_access_count: totalAccess };
    }
    promoteEligible(dryRun) {
        const results = [];
        for (const [key, thresh] of Object.entries(PROMOTION_THRESHOLDS)) {
            const [fromTier, toTier] = key.split('_TO_');
            const rows = this.db.prepare('SELECT id FROM knowledge_entries WHERE tier = ? AND access_count >= ? AND confidence >= ? AND archived_at IS NULL').all(fromTier, thresh.access, thresh.confidence);
            for (const row of rows) {
                if (!dryRun)
                    this.transition(row.id, fromTier, toTier, 'auto:promote');
                results.push({ entry_id: row.id, from: fromTier, to: toTier, reason: 'threshold_met' });
            }
        }
        return results;
    }
    demoteInactive(dryRun) {
        const results = [];
        for (const [key, thresh] of Object.entries(DEMOTION_THRESHOLDS)) {
            const [fromTier, toTier] = key.split('_TO_');
            const cutoff = new Date(Date.now() - thresh.daysInactive * 86400000).toISOString();
            const rows = this.db.prepare('SELECT id FROM knowledge_entries WHERE tier = ? AND (last_accessed_at IS NULL OR last_accessed_at < ?) AND access_count < ?').all(fromTier, cutoff, thresh.minAccess);
            for (const row of rows) {
                if (!dryRun)
                    this.transition(row.id, fromTier, toTier, 'auto:demote_inactive');
                results.push({ entry_id: row.id, from: fromTier, to: toTier, reason: 'inactive' });
            }
        }
        return results;
    }
    mergeDuplicates(dryRun) {
        const rows = this.db.prepare("SELECT summary, type, GROUP_CONCAT(id) as ids, COUNT(*) as cnt FROM knowledge_entries WHERE archived_at IS NULL GROUP BY summary, type HAVING cnt > 1 LIMIT 20").all();
        const results = [];
        for (const row of rows) {
            const ids = row.ids.split(',').map((s) => parseInt(s, 10));
            if (!dryRun)
                this.mergeEntries(ids[0], ids.slice(1), 'append', false);
            results.push({ survivor_id: ids[0], merged_ids: ids.slice(1), summary: row.summary?.slice(0, 60) });
        }
        return results;
    }
    transition(entryId, from, to, reason) {
        this.db.prepare("UPDATE knowledge_entries SET tier = ?, updated_at = datetime('now') WHERE id = ?").run(to, entryId);
        this.db.prepare('INSERT INTO consolidation_log (entry_id, from_tier, to_tier, reason) VALUES (?, ?, ?, ?)').run(entryId, from, to, reason);
    }
    getEntry(id) {
        return this.db.prepare('SELECT * FROM knowledge_entries WHERE id = ?').get(id);
    }
    applyStrategy(survivor, entries, strategy) {
        if (strategy === 'newest') {
            const all = [survivor, ...entries];
            return all.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0].content;
        }
        const parts = [survivor.content, ...entries.map(e => `\n---\n[Merged from #${e.id}]\n${e.content}`)];
        return parts.join('\n');
    }
}
exports.ConsolidationEngineV2 = ConsolidationEngineV2;
//# sourceMappingURL=consolidation-engine-v2.js.map