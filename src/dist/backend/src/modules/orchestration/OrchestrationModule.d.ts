/**
 * OrchestrationModule — manages child MCP servers and orchestration tools.
 * Implements TDD §5.2 modules/orchestration/OrchestrationModule.ts.
 */
import { IModule, ModuleStatus } from '../../types/module';
import { ToolDefinition, ToolHandler } from '../../types/tool';
export declare class OrchestrationModule implements IModule {
    readonly name = "orchestration";
    private _status;
    get status(): ModuleStatus;
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getToolHandlers(): Map<string, ToolHandler>;
    getToolDefinitions(): ToolDefinition[];
    private createHandler;
}
//# sourceMappingURL=OrchestrationModule.d.ts.map