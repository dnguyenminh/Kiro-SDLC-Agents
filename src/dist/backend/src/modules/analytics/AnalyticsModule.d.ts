/**
 * AnalyticsModule — handles analytics and quality scoring tools.
 * Implements TDD §5.2 modules/analytics/AnalyticsModule.ts.
 */
import { IModule, ModuleStatus } from '../../types/module';
import { ToolDefinition, ToolHandler } from '../../types/tool';
export declare class AnalyticsModule implements IModule {
    readonly name = "analytics";
    private _status;
    get status(): ModuleStatus;
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getToolHandlers(): Map<string, ToolHandler>;
    getToolDefinitions(): ToolDefinition[];
}
//# sourceMappingURL=AnalyticsModule.d.ts.map