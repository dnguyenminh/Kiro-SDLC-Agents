/**
 * Integration test for health route.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { ModuleRegistry } from '../src/modules/ModuleRegistry';
import { MemoryModule } from '../src/modules/memory/MemoryModule';
import { createHealthRoute } from '../src/server/routes/health';
describe('Health Route', () => {
    let app;
    let registry;
    beforeAll(async () => {
        registry = new ModuleRegistry();
        registry.register(new MemoryModule());
        app = new Hono();
        const healthRoute = createHealthRoute(registry, '1.0.0');
        app.route('/', healthRoute);
    });
    it('returns 503 when modules not ready', async () => {
        const res = await app.request('/health');
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.status).toBe('starting');
        expect(body.version).toBe('1.0.0');
    });
    it('returns 200 when all modules ready', async () => {
        await registry.initializeAll();
        const res = await app.request('/health');
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.status).toBe('healthy');
        expect(body.version).toBe('1.0.0');
        expect(body.tools_loaded).toBeGreaterThan(0);
        expect(body.modules.memory).toBe('ready');
    });
    it('includes uptime in response', async () => {
        const res = await app.request('/health');
        const body = await res.json();
        expect(body.uptime).toBeGreaterThanOrEqual(0);
    });
});
//# sourceMappingURL=health.route.test.js.map