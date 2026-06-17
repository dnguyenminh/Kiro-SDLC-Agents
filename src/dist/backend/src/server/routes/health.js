/**
 * Health route — GET /health.
 * Implements TDD §3.2, FSD UC-1, BR-13, BR-27, BR-30.
 */
import { Hono } from 'hono';
const startTime = Date.now();
export function createHealthRoute(moduleRegistry, version) {
    const app = new Hono();
    app.get('/health', (c) => {
        const statuses = moduleRegistry.getModuleStatuses();
        const allReady = moduleRegistry.isAllReady();
        const toolCount = moduleRegistry.getAllToolDefinitions().length;
        const status = allReady ? 'healthy' : 'starting';
        const httpStatus = allReady ? 200 : 503;
        return c.json({
            status,
            version,
            uptime: Math.floor((Date.now() - startTime) / 1000),
            tools_loaded: toolCount,
            modules: statuses,
        }, httpStatus);
    });
    return app;
}
//# sourceMappingURL=health.js.map