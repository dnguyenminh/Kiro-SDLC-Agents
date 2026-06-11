/**
 * Tools routes — GET /mcp/tools/list, POST /mcp/tools/call.
 * Implements TDD §3.3, §3.4, FSD UC-2, BR-6..BR-11.
 */

import { Hono } from 'hono';
import { ToolRouter } from '../../tools/ToolRouter';
import { ToolValidator } from '../../tools/ToolValidator';
import { ModuleRegistry } from '../../modules/ModuleRegistry';

export function createToolsRoute(toolRouter: ToolRouter, moduleRegistry: ModuleRegistry): Hono {
  const app = new Hono();
  const validator = new ToolValidator();

  // GET /mcp/tools/list
  app.get('/mcp/tools/list', (c) => {
    const tools = toolRouter.listTools();
    return c.json({ tools });
  });

  // POST /mcp/tools/call
  app.post('/mcp/tools/call', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({
        error: { code: 'INVALID_REQUEST', message: 'Invalid JSON body' },
      }, 400);
    }

    const { tool_name, arguments: args } = body as { tool_name?: string; arguments?: Record<string, unknown> };

    if (!tool_name) {
      return c.json({
        error: { code: 'INVALID_REQUEST', message: 'Missing required field: tool_name' },
      }, 400);
    }

    // Check if tool exists
    if (!toolRouter.hasHandler(tool_name)) {
      return c.json({
        error: { code: 'TOOL_NOT_FOUND', message: "Tool '" + tool_name + "' not found" },
      }, 404);
    }

    // Check module readiness
    const moduleName = (toolRouter as any).getModuleForTool?.(tool_name);
    if (moduleName) {
      const module = moduleRegistry.getModule(moduleName);
      if (module && module.status !== 'ready') {
        return c.json({
          error: { code: 'MODULE_UNAVAILABLE', message: "Module '" + moduleName + "' is not ready" },
        }, 503);
      }
    }

    // Validate arguments
    const definitions = toolRouter.listTools();
    const definition = definitions.find((d) => d.name === tool_name);
    const validation = validator.validateToolCall(tool_name, args, definition);
    if (!validation.valid) {
      return c.json({
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed: ' + validation.errors.join(', ') },
      }, 422);
    }

    // Execute tool
    const result = await toolRouter.route(tool_name, args ?? {});
    return c.json(result);
  });

  return app;
}
