import type { Logger } from 'pino';
import type { ToolDefinition } from '../../types/tool.js';
export declare class McpClientManager {
    private clients;
    private toolsToServer;
    private proxiedTools;
    private logger;
    constructor(logger: Logger);
    initializeAll(): Promise<void>;
    getProxiedTools(): ToolDefinition[];
    ownsTool(toolName: string): boolean;
    executeTool(toolName: string, args: any): Promise<any>;
    shutdownAll(): Promise<void>;
}
