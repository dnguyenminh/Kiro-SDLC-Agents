/**
 * MemoryModule — handles mem_* tool operations.
 * Implements TDD §5.2 modules/memory/MemoryModule.ts.
 * Business logic placeholder — actual implementation migrated from monolith.
 */
import { IModule, ModuleStatus } from '../../types/module';
import { ToolDefinition, ToolHandler } from '../../types/tool';
export declare class MemoryModule implements IModule {
    readonly name = "memory";
    private _status;
    get status(): ModuleStatus;
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getToolHandlers(): Map<string, ToolHandler>;
    getToolDefinitions(): ToolDefinition[];
    private createHandler;
}
//# sourceMappingURL=MemoryModule.d.ts.map