/**
 * Tools routes — GET /mcp/tools/list, POST /mcp/tools/call.
 * Implements TDD §3.3, §3.4, FSD UC-2, BR-6..BR-11.
 */
import { Hono } from 'hono';
import { ToolRouter } from '../../tools/ToolRouter';
import { ModuleRegistry } from '../../modules/ModuleRegistry';
export declare function createToolsRoute(toolRouter: ToolRouter, moduleRegistry: ModuleRegistry): Hono;
//# sourceMappingURL=tools.d.ts.map