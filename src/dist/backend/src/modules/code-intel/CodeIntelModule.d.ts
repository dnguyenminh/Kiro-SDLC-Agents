/**
 * CodeIntelModule — handles code_* tool operations.
 * Implements TDD §5.2 modules/code-intel/CodeIntelModule.ts.
 */
import { IModule, ModuleStatus } from '../../types/module';
import { ToolDefinition, ToolHandler } from '../../types/tool';
export declare class CodeIntelModule implements IModule {
    readonly name = "codeIntel";
    private _status;
    get status(): ModuleStatus;
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getToolHandlers(): Map<string, ToolHandler>;
    getToolDefinitions(): ToolDefinition[];
    private createHandler;
}
//# sourceMappingURL=CodeIntelModule.d.ts.map