/**
 * Memory Module — handles mem_* tool operations.
 * Provides semantic search, memory storage, and retrieval.
 * In this stub: registers tool definitions but actual logic is placeholder.
 */
import type { IModule, ModuleStatus } from '../../types/module.js';
import type { ToolHandler, ToolDefinition } from '../../types/tool.js';
import type { Logger } from 'pino';
export declare class MemoryModule implements IModule {
    readonly name = "memory";
    private _status;
    private logger;
    constructor(logger: Logger);
    get status(): ModuleStatus;
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getToolHandlers(): Map<string, ToolHandler>;
    getToolDefinitions(): ToolDefinition[];
}
