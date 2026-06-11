/**
 * ToolRouter — routes tool calls to appropriate module handlers.
 * Implements TDD §5.3 IToolRouter, §5.4 Registry pattern.
 */

import { ToolDefinition, ToolHandler, ToolResult } from '../types/tool';
import { ModuleRegistry } from '../modules/ModuleRegistry';

export interface IToolRouter {
  route(toolName: string, args: Record<string, unknown>): Promise<ToolResult>;
  listTools(): ToolDefinition[];
  hasHandler(toolName: string): boolean;
}

export class ToolRouter implements IToolRouter {
  private readonly moduleRegistry: ModuleRegistry;

  constructor(moduleRegistry: ModuleRegistry) {
    this.moduleRegistry = moduleRegistry;
  }

  async route(toolName: string, args: Record<string, unknown>): Promise<ToolResult> {
    const handlers = this.moduleRegistry.getAllToolHandlers();
    const handler = handlers.get(toolName);

    if (!handler) {
      return {
        content: [{ type: 'text', text: `Tool '${toolName}' not found` }],
        isError: true,
      };
    }

    try {
      return await handler(args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Tool execution failed: ${message}` }],
        isError: true,
      };
    }
  }

  listTools(): ToolDefinition[] {
    return this.moduleRegistry.getAllToolDefinitions();
  }

  hasHandler(toolName: string): boolean {
    return this.moduleRegistry.getAllToolHandlers().has(toolName);
  }

  getModuleForTool(toolName: string): string | undefined {
    for (const module of this.moduleRegistry.getAllModules()) {
      if (module.getToolHandlers().has(toolName)) {
        return module.name;
      }
    }
    return undefined;
  }
}
