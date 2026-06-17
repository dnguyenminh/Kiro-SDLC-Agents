/**
 * Utility Module — agent_log, stream_write_file, drawio_* tools.
 */
import type { IModule, ModuleStatus } from '../../types/module.js';
import type { ToolHandler, ToolDefinition } from '../../types/tool.js';
import type { Logger } from 'pino';
export declare class UtilityModule implements IModule {
    readonly name = "utility";
    private _status;
    private logger;
    constructor(logger: Logger);
    get status(): ModuleStatus;
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getToolHandlers(): Map<string, ToolHandler>;
    getToolDefinitions(): ToolDefinition[];
}
