/**
 * MCP Tools endpoints — GET /mcp/tools/list, POST /mcp/tools/call
 * Implements: UC-2, UC-7, BR-6, BR-7, BR-8, BR-9, BR-11
 */
import { Hono } from 'hono';
import type { ToolRouter } from '../../tools/ToolRouter.js';
import type { Logger } from 'pino';
export declare function createToolsRoute(router: ToolRouter, logger: Logger): Hono;
