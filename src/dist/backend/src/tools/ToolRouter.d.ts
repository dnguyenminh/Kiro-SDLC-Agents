/**
 * ToolRouter — routes tool calls to appropriate module handlers.
 * Implements TDD §5.3 IToolRouter, §5.4 Registry pattern.
 */
import { ToolDefinition, ToolResult } from '../types/tool';
import { ModuleRegistry } from '../modules/ModuleRegistry';
export interface IToolRouter {
    route(toolName: string, args: Record<string, unknown>): Promise<ToolResult>;
    listTools(): ToolDefinition[];
    hasHandler(toolName: string): boolean;
}
export declare class ToolRouter implements IToolRouter {
    private readonly moduleRegistry;
    constructor(moduleRegistry: ModuleRegistry);
    route(toolName: string, args: Record<string, unknown>): Promise<ToolResult>;
    listTools(): ToolDefinition[];
    hasHandler(toolName: string): boolean;
    getModuleForTool(toolName: string): string | undefined;
}
//# sourceMappingURL=ToolRouter.d.ts.map