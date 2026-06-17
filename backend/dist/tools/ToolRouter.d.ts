/**
 * Tool routing layer.
 * Routes tool_name to the appropriate module handler.
 * Validates arguments against tool schemas using zod.
 */
import type { ToolDefinition, ToolResult, ToolCallRequest } from '../types/tool.js';
import type { ModuleRegistry } from '../modules/ModuleRegistry.js';
import type { Logger } from 'pino';
export declare class ToolRouter {
    private registry;
    private logger;
    constructor(registry: ModuleRegistry, logger: Logger);
    route(request: ToolCallRequest): Promise<ToolResult>;
    listTools(): ToolDefinition[];
    hasTools(): boolean;
    getToolCount(): number;
}
