/**
 * UtilityModule — handles agent_log, stream_write_file, drawio_* tools.
 * Implements TDD §5.2 modules/utility/UtilityModule.ts.
 */
import { IModule, ModuleStatus } from '../../types/module';
import { ToolDefinition, ToolHandler } from '../../types/tool';
export declare class UtilityModule implements IModule {
    readonly name = "utility";
    private _status;
    get status(): ModuleStatus;
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getToolHandlers(): Map<string, ToolHandler>;
    getToolDefinitions(): ToolDefinition[];
    private createHandler;
}
//# sourceMappingURL=UtilityModule.d.ts.map