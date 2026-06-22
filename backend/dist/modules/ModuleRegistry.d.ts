/**
 * Module lifecycle registry.
 * Manages initialization, shutdown, and health status of all backend modules.
 */
import type { IModule, ModuleHealth, ModuleStatus } from '../types/module.js';
import type { ToolHandler, ToolDefinition } from '../types/tool.js';
import type { Logger } from 'pino';
export declare class ModuleRegistry {
    private modules;
    private logger;
    constructor(logger: Logger);
    register(module: IModule): void;
    initializeAll(): Promise<void>;
    shutdownAll(): Promise<void>;
    getToolHandlers(): Map<string, ToolHandler>;
    getModule(name: string): IModule | undefined;
    getAllToolDefinitions(): ToolDefinition[];
    getHealth(): Record<string, ModuleStatus>;
    getModuleHealth(): ModuleHealth[];
    getReadyCount(): number;
    getTotalCount(): number;
    isAllReady(): boolean;
}
