/**
 * code_search tool — Full-text search across indexed codebase using FTS5.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { QueryLayer } from '../query/query-layer.js';
export declare function registerCodeSearch(server: McpServer, queryLayer: QueryLayer): void;
