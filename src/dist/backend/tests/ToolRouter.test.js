/**
 * Unit tests for ToolRouter.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRouter } from '../src/tools/ToolRouter';
import { ModuleRegistry } from '../src/modules/ModuleRegistry';
class MockModule {
    tools;
    name;
    _status = 'ready';
    get status() {
        return this._status;
    }
    constructor(name, tools = []) {
        this.tools = tools;
        this.name = name;
    }
    async initialize() {
        this._status = 'ready';
    }
    async shutdown() {
        this._status = 'initializing';
    }
    getToolHandlers() {
        const handlers = new Map();
        for (const tool of this.tools) {
            handlers.set(tool.name, async (_args) => ({
                content: [{ type: 'text', text: tool.name + ' result' }],
                isError: false,
            }));
        }
        return handlers;
    }
    getToolDefinitions() {
        return this.tools;
    }
}
describe('ToolRouter', () => {
    let router;
    let registry;
    beforeEach(() => {
        registry = new ModuleRegistry();
        const mockModule = new MockModule('test', [
            { name: 'test_tool', description: 'A test tool', inputSchema: { type: 'object', properties: {} }, category: 'utility' },
        ]);
        registry.register(mockModule);
        router = new ToolRouter(registry);
    });
    it('routes to correct handler', async () => {
        await registry.initializeAll();
        const result = await router.route('test_tool', {});
        expect(result.isError).toBe(false);
        expect(result.content[0].text).toBe('test_tool result');
    });
    it('returns error for unknown tool', async () => {
        await registry.initializeAll();
        const result = await router.route('nonexistent', {});
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('not found');
    });
    it('lists all tools', async () => {
        await registry.initializeAll();
        const tools = router.listTools();
        expect(tools).toHaveLength(1);
        expect(tools[0].name).toBe('test_tool');
    });
    it('hasHandler returns correct values', async () => {
        await registry.initializeAll();
        expect(router.hasHandler('test_tool')).toBe(true);
        expect(router.hasHandler('nonexistent')).toBe(false);
    });
});
//# sourceMappingURL=ToolRouter.test.js.map