/**
 * Integration test for tools route.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { ModuleRegistry } from '../src/modules/ModuleRegistry';
import { MemoryModule } from '../src/modules/memory/MemoryModule';
import { ToolRouter } from '../src/tools/ToolRouter';
import { createToolsRoute } from '../src/server/routes/tools';
describe('Tools Route', () => {
    let app;
    let registry;
    beforeAll(async () => {
        registry = new ModuleRegistry();
        registry.register(new MemoryModule());
        await registry.initializeAll();
        const toolRouter = new ToolRouter(registry);
        app = new Hono();
        const toolsRoute = createToolsRoute(toolRouter, registry);
        app.route('/', toolsRoute);
    });
    it('GET /mcp/tools/list returns tools', async () => {
        const res = await app.request('/mcp/tools/list');
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.tools).toBeInstanceOf(Array);
        expect(body.tools.length).toBeGreaterThan(0);
        expect(body.tools[0]).toHaveProperty('name');
        expect(body.tools[0]).toHaveProperty('description');
        expect(body.tools[0]).toHaveProperty('inputSchema');
    });
    it('POST /mcp/tools/call executes tool', async () => {
        const res = await app.request('/mcp/tools/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool_name: 'mem_search', arguments: { query: 'test' } }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.isError).toBe(false);
        expect(body.content).toBeInstanceOf(Array);
    });
    it('POST /mcp/tools/call returns 400 for missing tool_name', async () => {
        const res = await app.request('/mcp/tools/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ arguments: {} }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe('INVALID_REQUEST');
    });
    it('POST /mcp/tools/call returns 404 for unknown tool', async () => {
        const res = await app.request('/mcp/tools/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool_name: 'nonexistent_tool', arguments: {} }),
        });
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.code).toBe('TOOL_NOT_FOUND');
    });
    it('POST /mcp/tools/call returns 422 for invalid arguments', async () => {
        const res = await app.request('/mcp/tools/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool_name: 'mem_search', arguments: {} }),
        });
        expect(res.status).toBe(422);
        const body = await res.json();
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });
});
//# sourceMappingURL=tools.route.test.js.map