/**
 * Backend module types.
 * Implements TDD §5.3 IModule interface.
 */
import { ToolHandler, ToolDefinition } from './tool';
export type ModuleStatus = 'initializing' | 'ready' | 'error';
export interface IModule {
    readonly name: string;
    readonly status: ModuleStatus;
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getToolHandlers(): Map<string, ToolHandler>;
    getToolDefinitions(): ToolDefinition[];
}
//# sourceMappingURL=module.d.ts.map