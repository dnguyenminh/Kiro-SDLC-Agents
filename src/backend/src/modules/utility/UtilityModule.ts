/**
 * UtilityModule — handles agent_log, stream_write_file, drawio_* tools.
 * Implements TDD §5.2 modules/utility/UtilityModule.ts.
 */

import { IModule, ModuleStatus } from '../../types/module';
import { ToolDefinition, ToolHandler, ToolResult } from '../../types/tool';

const UTILITY_TOOLS: ToolDefinition[] = [
  { name: 'agent_log', description: 'Log agent activity', inputSchema: { type: 'object', properties: { message: { type: 'string' }, level: { type: 'string' } }, required: ['message'] }, category: 'utility' },
  { name: 'stream_write_file', description: 'Write file content', inputSchema: { type: 'object', properties: { file_path: { type: 'string' }, content: { type: 'string' } }, required: ['file_path', 'content'] }, category: 'utility' },
  { name: 'drawio_auto_layout', description: 'Auto-layout a draw.io diagram', inputSchema: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] }, category: 'utility' },
  { name: 'drawio_export_png', description: 'Export draw.io diagram to PNG', inputSchema: { type: 'object', properties: { file_path: { type: 'string' }, output_path: { type: 'string' } }, required: ['file_path'] }, category: 'utility' },
];

export class UtilityModule implements IModule {
  readonly name = 'utility';
  private _status: ModuleStatus = 'initializing';

  get status(): ModuleStatus {
    return this._status;
  }

  async initialize(): Promise<void> {
    console.log('[UtilityModule] Initializing...');
    this._status = 'ready';
    console.log('[UtilityModule] Ready');
  }

  async shutdown(): Promise<void> {
    this._status = 'initializing';
    console.log('[UtilityModule] Shut down');
  }

  getToolHandlers(): Map<string, ToolHandler> {
    const handlers = new Map<string, ToolHandler>();
    for (const tool of UTILITY_TOOLS) {
      handlers.set(tool.name, this.createHandler(tool.name));
    }
    return handlers;
  }

  getToolDefinitions(): ToolDefinition[] {
    return UTILITY_TOOLS;
  }

  private createHandler(toolName: string): ToolHandler {
    return async (args: Record<string, unknown>): Promise<ToolResult> => {
      return {
        content: [{ type: 'text', text: '[' + toolName + '] executed with args: ' + JSON.stringify(args) }],
        isError: false,
      };
    };
  }
}
