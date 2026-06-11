/**
 * KBGraphModule — handles knowledge base graph operations.
 * Implements TDD §5.2 modules/kb-graph/KBGraphModule.ts.
 */

import { IModule, ModuleStatus } from '../../types/module';
import { ToolDefinition, ToolHandler, ToolResult } from '../../types/tool';

const KB_GRAPH_TOOLS: ToolDefinition[] = [
  // KB Graph data is served via /api/kb/graph endpoints
  // No direct MCP tool mapping for this module
];

export class KBGraphModule implements IModule {
  readonly name = 'kbGraph';
  private _status: ModuleStatus = 'initializing';

  get status(): ModuleStatus {
    return this._status;
  }

  async initialize(): Promise<void> {
    console.log('[KBGraphModule] Initializing...');
    this._status = 'ready';
    console.log('[KBGraphModule] Ready');
  }

  async shutdown(): Promise<void> {
    this._status = 'initializing';
    console.log('[KBGraphModule] Shut down');
  }

  getToolHandlers(): Map<string, ToolHandler> {
    return new Map<string, ToolHandler>();
  }

  getToolDefinitions(): ToolDefinition[] {
    return KB_GRAPH_TOOLS;
  }
}
