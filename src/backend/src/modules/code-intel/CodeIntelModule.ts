/**
 * CodeIntelModule — handles code_* tool operations.
 * Implements TDD §5.2 modules/code-intel/CodeIntelModule.ts.
 */

import { IModule, ModuleStatus } from '../../types/module';
import { ToolDefinition, ToolHandler, ToolResult } from '../../types/tool';

const CODE_TOOLS: ToolDefinition[] = [
  { name: 'code_search', description: 'Search code by semantic query', inputSchema: { type: 'object', properties: { query: { type: 'string' }, scope: { type: 'string' } }, required: ['query'] }, category: 'code' },
  { name: 'code_symbols', description: 'Get symbols in a file', inputSchema: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] }, category: 'code' },
  { name: 'code_context', description: 'Get code context for a symbol', inputSchema: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] }, category: 'code' },
  { name: 'code_modules', description: 'List project modules', inputSchema: { type: 'object', properties: {} }, category: 'code' },
  { name: 'code_index_status', description: 'Get indexing status', inputSchema: { type: 'object', properties: {} }, category: 'code' },
  { name: 'code_callers', description: 'Find callers of a symbol', inputSchema: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] }, category: 'code' },
  { name: 'code_callees', description: 'Find callees of a symbol', inputSchema: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] }, category: 'code' },
  { name: 'code_dependencies', description: 'Get file dependencies', inputSchema: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] }, category: 'code' },
  { name: 'code_impact', description: 'Analyze impact of changes', inputSchema: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] }, category: 'code' },
  { name: 'code_traverse', description: 'Traverse code graph', inputSchema: { type: 'object', properties: { start: { type: 'string' }, direction: { type: 'string' } }, required: ['start'] }, category: 'code' },
  { name: 'complexity_analysis', description: 'Analyze code complexity', inputSchema: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] }, category: 'code' },
  { name: 'find_entry_points', description: 'Find application entry points', inputSchema: { type: 'object', properties: {} }, category: 'code' },
  { name: 'find_circular_deps', description: 'Find circular dependencies', inputSchema: { type: 'object', properties: {} }, category: 'code' },
  { name: 'find_related_tests', description: 'Find tests for a file', inputSchema: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] }, category: 'code' },
  { name: 'find_hot_paths', description: 'Find performance hot paths', inputSchema: { type: 'object', properties: {} }, category: 'code' },
  { name: 'find_dead_imports', description: 'Find unused imports', inputSchema: { type: 'object', properties: { file_path: { type: 'string' } } }, category: 'code' },
  { name: 'module_summary', description: 'Get module summary', inputSchema: { type: 'object', properties: { module_name: { type: 'string' } }, required: ['module_name'] }, category: 'code' },
  { name: 'get_ai_context', description: 'Get AI-optimized context', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }, category: 'code' },
  { name: 'get_edit_context', description: 'Get edit context for a file', inputSchema: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] }, category: 'code' },
  { name: 'get_curated_context', description: 'Get curated context', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }, category: 'code' },
  { name: 'find_duplicates', description: 'Find code duplicates', inputSchema: { type: 'object', properties: {} }, category: 'code' },
  { name: 'find_dead_code', description: 'Find unused code', inputSchema: { type: 'object', properties: {} }, category: 'code' },
  { name: 'git_search', description: 'Search git history', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }, category: 'code' },
  { name: 'git_index', description: 'Index git repository', inputSchema: { type: 'object', properties: {} }, category: 'code' },
  { name: 'code_kb_export', description: 'Export code intel to KB', inputSchema: { type: 'object', properties: {} }, category: 'code' },
];

export class CodeIntelModule implements IModule {
  readonly name = 'codeIntel';
  private _status: ModuleStatus = 'initializing';

  get status(): ModuleStatus {
    return this._status;
  }

  async initialize(): Promise<void> {
    console.log('[CodeIntelModule] Initializing...');
    this._status = 'ready';
    console.log('[CodeIntelModule] Ready');
  }

  async shutdown(): Promise<void> {
    this._status = 'initializing';
    console.log('[CodeIntelModule] Shut down');
  }

  getToolHandlers(): Map<string, ToolHandler> {
    const handlers = new Map<string, ToolHandler>();
    for (const tool of CODE_TOOLS) {
      handlers.set(tool.name, this.createHandler(tool.name));
    }
    return handlers;
  }

  getToolDefinitions(): ToolDefinition[] {
    return CODE_TOOLS;
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
