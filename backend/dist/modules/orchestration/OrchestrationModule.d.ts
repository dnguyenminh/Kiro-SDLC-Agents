/**
 * Orchestration Module — manages child MCP servers.
 * Handles spawning, monitoring, and communication with child servers.
 */
import type { IModule, ModuleStatus } from '../../types/module.js';
import type { ToolHandler, ToolDefinition } from '../../types/tool.js';
import type { Logger } from 'pino';
export declare class OrchestrationModule implements IModule {
    readonly name = "orchestration";
    private _status;
    private logger;
    constructor(logger: Logger);
    get status(): ModuleStatus;
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getToolHandlers(): Map<string, ToolHandler>;
    getToolDefinitions(): ToolDefinition[];
}
