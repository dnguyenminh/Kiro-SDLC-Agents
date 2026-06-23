/**
 * code_modules tool — List discovered modules with file/symbol counts.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { QueryLayer } from '../query/query-layer.js';
export declare function registerCodeModules(server: McpServer, queryLayer: QueryLayer): void;
