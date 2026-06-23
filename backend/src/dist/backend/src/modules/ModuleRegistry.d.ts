/**
 * ModuleRegistry — manages module lifecycle (initialize, shutdown).
 * Implements TDD §5.2 modules/ModuleRegistry.ts, §5.4 Registry pattern.
 */
import { IModule, ModuleStatus } from '../types/module';
import { ToolHandler, ToolDefinition } from '../types/tool';
export declare class ModuleRegistry {
    private readonly modules;
    register(module: IModule): void;
    initializeAll(): Promise<void>;
    shutdownAll(): Promise<void>;
    getModule(name: string): IModule | undefined;
    getAllModules(): IModule[];
    getModuleStatuses(): Record<string, ModuleStatus>;
    getAllToolHandlers(): Map<string, ToolHandler>;
    getAllToolDefinitions(): ToolDefinition[];
    isAllReady(): boolean;
    get size(): number;
}
//# sourceMappingURL=ModuleRegistry.d.ts.map