/**
 * KB Graph Module — knowledge graph operations.
 */
import type { IModule, ModuleStatus } from '../../types/module.js';
import type { ToolHandler, ToolDefinition } from '../../types/tool.js';
import type { Logger } from 'pino';
export declare class KBGraphModule implements IModule {
    readonly name = "kbGraph";
    private _status;
    private logger;
    private graphService;
    constructor(logger: Logger);
    get status(): ModuleStatus;
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getToolHandlers(): Map<string, ToolHandler>;
    getToolDefinitions(): ToolDefinition[];
}
