// KSA-286: KB Admin Router
import { Router } from 'express';
import { KBAdminService } from '../services/kb-admin.service.js';
export function kbAdminRouter(deps) {
    const router = Router();
    const svc = new KBAdminService(deps.db, deps.kbEngine);
    router.get('/entries', (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const size = Math.min(parseInt(req.query.size) || 20, 100);
        const result = svc.listEntries({ tier: req.query.tier, tags: req.query.tags, search: req.query.search }, { page, size });
        res.json({ success: true, ...result });
    });
    router.post('/entries/:id/links', (req, res) => {
        try {
            svc.createLink(req.params.id, req.body.targetEntryId, req.body.linkType);
            res.status(201).json({ success: true });
        }
        catch (e) {
            const s = e.code === 'CIRCULAR_LINK' ? 409 : 400;
            res.status(s).json({ success: false, error: { code: e.code, message: e.message } });
        }
    });
    router.delete('/entries/:id/links/:targetId', (req, res) => { svc.removeLink(req.params.id, req.params.targetId); res.json({ success: true }); });
    router.patch('/entries/:id/tags', (req, res) => {
        try {
            svc.updateTags(req.params.id, req.body.tags);
            res.json({ success: true });
        }
        catch (e) {
            res.status(400).json({ success: false, error: { code: e.code, message: e.message } });
        }
    });
    router.get('/promotion', (_req, res) => { res.json({ success: true, data: { promotions: svc.listPromotions() } }); });
    router.post('/promotion/review', (req, res) => {
        try {
            svc.reviewPromotion(req.body, req.userId);
            res.json({ success: true });
        }
        catch (e) {
            res.status(400).json({ success: false, error: { code: e.code, message: e.message } });
        }
    });
    router.get('/graph', (req, res) => {
        const data = svc.getGraphData({ tier: req.query.tier, minQuality: parseInt(req.query.minQuality) || undefined, limit: parseInt(req.query.limit) || 500 });
        res.json({ success: true, data });
    });
    return router;
}
//# sourceMappingURL=kb-admin.router.js.map