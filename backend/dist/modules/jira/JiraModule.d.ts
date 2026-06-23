import type { Logger } from 'pino';
import type { IModule, ModuleStatus } from '../../types/module.js';
import type { ToolDefinition, ToolHandler } from '../../types/tool.js';
export declare class JiraModule implements IModule {
    readonly name = "jira";
    status: ModuleStatus;
    private logger;
    private workspaceRoot;
    constructor(logger: Logger);
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getToolDefinitions(): ToolDefinition[];
    getToolHandlers(): Map<string, ToolHandler>;
}
