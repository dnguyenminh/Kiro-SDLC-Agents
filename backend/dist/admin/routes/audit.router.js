// KSA-286: Audit Router
import { Router } from 'express';
import { AuditService } from '../services/audit.service.js';
export function auditRouter(deps) {
    const router = Router();
    const svc = new AuditService(deps.db);
    router.get('/', (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const size = Math.min(parseInt(req.query.size) || 50, 100);
        const result = svc.list({ userId: req.query.userId, action: req.query.action, dateFrom: req.query.dateFrom, dateTo: req.query.dateTo }, { page, size });
        res.json({ success: true, ...result });
    });
    router.get('/export', (req, res) => {
        const { format, dateFrom, dateTo } = req.query;
        if (!format || !dateFrom || !dateTo) {
            res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'format, dateFrom, dateTo required' } });
            return;
        }
        const data = svc.export(format, dateFrom, dateTo);
        const mime = format === 'csv' ? 'text/csv' : 'application/json';
        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Disposition', `attachment; filename=audit-export.${format}`);
        res.send(data);
    });
    return router;
}
//# sourceMappingURL=audit.router.js.map