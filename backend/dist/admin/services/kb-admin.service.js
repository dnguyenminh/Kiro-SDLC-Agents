// KSA-286: KB Admin Service
import { AdminErrorCode } from '../types/admin.types.js';
export class KBAdminService {
    db;
    kbEngine;
    constructor(db, kbEngine) {
        this.db = db;
        this.kbEngine = kbEngine;
    }
    listEntries(filters, pagination) {
        // Delegate to KB engine with pagination
        const result = this.kbEngine?.listEntries?.({ ...filters, page: pagination.page, size: pagination.size });
        if (result)
            return result;
        return { items: [], pagination: { page: pagination.page, size: pagination.size, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
    }
    createLink(sourceId, targetId, linkType = 'related') {
        // BR-10: Circular link detection (BFS)
        if (this.hasCircularLink(sourceId, targetId))
            throw { code: AdminErrorCode.CIRCULAR_LINK };
        this.kbEngine?.createLink?.(sourceId, targetId, linkType);
    }
    removeLink(sourceId, targetId) { this.kbEngine?.removeLink?.(sourceId, targetId); }
    updateTags(entryId, tags) {
        // BR-06: validate tag format, BR-07: max 20
        for (const tag of tags) {
            if (!/^[a-z0-9-]{1,50}$/.test(tag))
                throw { code: AdminErrorCode.VALIDATION_ERROR, message: `Invalid tag: ${tag}` };
        }
        if (tags.length > 20)
            throw { code: AdminErrorCode.VALIDATION_ERROR, message: 'Max 20 tags' };
        this.kbEngine?.updateTags?.(entryId, tags);
    }
    reviewPromotion(data, reviewerId) {
        if (data.comment.length < 10)
            throw { code: AdminErrorCode.COMMENT_TOO_SHORT };
        const promo = this.db.prepare('SELECT * FROM kb_promotion_queue WHERE entry_id = ? AND status = ?').get(data.entryId, 'PENDING');
        if (!promo)
            throw { code: AdminErrorCode.PROMOTION_NOT_PENDING };
        if (data.decision === 'APPROVE') {
            this.db.prepare('UPDATE kb_promotion_queue SET status = ?, review_comment = ?, reviewed_by = ?, reviewed_at = datetime("now") WHERE promotion_id = ?').run('APPROVED', data.comment, reviewerId, promo.promotion_id);
            this.kbEngine?.promoteEntry?.(data.entryId, data.targetTier || promo.target_tier);
        }
        else {
            const cooldown = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            this.db.prepare('UPDATE kb_promotion_queue SET status = ?, review_comment = ?, reviewed_by = ?, reviewed_at = datetime("now"), cooldown_until = ? WHERE promotion_id = ?').run('REJECTED', data.comment, reviewerId, cooldown, promo.promotion_id);
        }
    }
    listPromotions() {
        return this.db.prepare('SELECT * FROM kb_promotion_queue WHERE status = ? ORDER BY created_at DESC').all('PENDING').map((r) => ({ promotionId: r.promotion_id, entryId: r.entry_id, sourceTier: r.source_tier, targetTier: r.target_tier, reason: r.reason, status: r.status, createdAt: r.created_at }));
    }
    getGraphData(filters) {
        return this.kbEngine?.getGraphData?.(filters) || { nodes: [], edges: [], clusters: [], totalCount: 0 };
    }
    hasCircularLink(sourceId, targetId) {
        const visited = new Set();
        const queue = [targetId];
        while (queue.length > 0) {
            const current = queue.shift();
            if (current === sourceId)
                return true;
            if (visited.has(current))
                continue;
            visited.add(current);
            const linked = this.kbEngine?.getLinkedEntries?.(current) || [];
            for (const entry of linked) {
                if (!visited.has(entry.id))
                    queue.push(entry.id);
            }
        }
        return false;
    }
}
//# sourceMappingURL=kb-admin.service.js.map