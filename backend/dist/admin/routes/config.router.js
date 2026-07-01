// KSA-286: Config Router
import { Router } from 'express';
import { ConfigService } from '../services/config.service.js';
export function configRouter(deps) {
    const router = Router();
    const svc = new ConfigService(deps.db);
    router.get('/', (req, res) => {
        const sections = req.userPermissions?.find((p) => p.permissionId === 'CONFIG_EDIT')?.roleData?.sections;
        res.json({ success: true, data: { sections: svc.getAll(sections) } });
    });
    router.patch('/:section/:key', (req, res) => {
        try {
            const result = svc.update(req.params.section, req.params.key, req.body.value, req.userId);
            res.json({ success: true, data: result });
        }
        catch (e) {
            res.status(400).json({ success: false, error: { code: e.code, message: e.message } });
        }
    });
    router.get('/history', (_req, res) => { res.json({ success: true, data: { history: svc.getHistory() } }); });
    return router;
}
//# sourceMappingURL=config.router.js.map