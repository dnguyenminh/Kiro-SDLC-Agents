/**
 * KBGraphModule — handles knowledge base graph operations.
 * Implements TDD §5.2 modules/kb-graph/KBGraphModule.ts.
 */
import { IModule, ModuleStatus } from '../../types/module';
import { ToolDefinition, ToolHandler } from '../../types/tool';
export declare class KBGraphModule implements IModule {
    readonly name = "kbGraph";
    private _status;
    get status(): ModuleStatus;
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getToolHandlers(): Map<string, ToolHandler>;
    getToolDefinitions(): ToolDefinition[];
}
//# sourceMappingURL=KBGraphModule.d.ts.map