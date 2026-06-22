/**
 * Memory Module — handles mem_* tool operations.
 * Provides semantic search, memory storage, and retrieval.
 * In this stub: registers tool definitions but actual logic is placeholder.
 */
import type { IModule, ModuleStatus } from '../../types/module.js';
import type { ToolHandler, ToolDefinition } from '../../types/tool.js';
import type { Logger } from 'pino';
import { MemoryEngine } from './MemoryEngine.js';
export declare class MemoryModule implements IModule {
    readonly name = "memory";
    private _status;
    private logger;
    private dbManager;
    private engine;
    private dispatcher;
    constructor(logger: Logger);
    get status(): ModuleStatus;
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getEngine(): MemoryEngine;
    getToolHandlers(): Map<string, ToolHandler>;
    getToolDefinitions(): ToolDefinition[];
}
