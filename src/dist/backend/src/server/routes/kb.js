/**
 * KB routes — /api/kb/* endpoints.
 * Implements TDD §3.2.3 POST /api/kb/promote.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { getAuthPayload, requireAdmin } from '../middleware/auth-guard';
const PromoteSchema = z.object({
    entry_id: z.string().uuid(),
    target_tier: z.union([z.literal(2), z.literal(3)]),
    project_id: z.string().optional(),
});
export function createKbRoute(promotionService, kbRepo, tierAccess) {
    const app = new Hono();
    app.post('/api/kb/promote', async (c) => {
        const payload = getAuthPayload(c);
        const body = await c.req.json();
        const parsed = PromoteSchema.safeParse(body);
        if (!parsed.success) {
            return c.json({
                error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', details: parsed.error.flatten() },
            }, 400);
        }
        const { entry_id, target_tier, project_id } = parsed.data;
        const entry = kbRepo.findById(entry_id);
        if (!entry) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'Entry not found.' } }, 404);
        }
        const context = { userId: payload.userId, projects: payload.projects, role: payload.role };
        if (!tierAccess.canPromote(entry, target_tier, context)) {
            return c.json({ error: { code: 'AUTH_FORBIDDEN', message: 'Insufficient permissions.' } }, 403);
        }
        if (target_tier === 3) {
            const adminCheck = requireAdmin(c);
            if (adminCheck)
                return adminCheck;
        }
        try {
            const result = promotionService.manualPromote(entry_id, target_tier, project_id, payload.userId);
            return c.json(result, 200);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Promotion failed';
            return c.json({ error: { code: 'PROMOTION_FAILED', message } }, 400);
        }
    });
    return app;
}
//# sourceMappingURL=kb.js.map