/**
 * ToolRouter — routes tool calls to appropriate module handlers.
 * Implements TDD §5.3 IToolRouter, §5.4 Registry pattern.
 */
export class ToolRouter {
    moduleRegistry;
    constructor(moduleRegistry) {
        this.moduleRegistry = moduleRegistry;
    }
    async route(toolName, args) {
        const handlers = this.moduleRegistry.getAllToolHandlers();
        const handler = handlers.get(toolName);
        if (!handler) {
            return {
                content: [{ type: 'text', text: `Tool '${toolName}' not found` }],
                isError: true,
            };
        }
        try {
            return await handler(args);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                content: [{ type: 'text', text: `Tool execution failed: ${message}` }],
                isError: true,
            };
        }
    }
    listTools() {
        return this.moduleRegistry.getAllToolDefinitions();
    }
    hasHandler(toolName) {
        return this.moduleRegistry.getAllToolHandlers().has(toolName);
    }
    getModuleForTool(toolName) {
        for (const module of this.moduleRegistry.getAllModules()) {
            if (module.getToolHandlers().has(toolName)) {
                return module.name;
            }
        }
        return undefined;
    }
}
//# sourceMappingURL=ToolRouter.js.map