/**
 * code_symbols tool — Lookup symbols by name, kind, or file path.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { QueryLayer } from '../query/query-layer.js';
export declare function registerCodeSymbols(server: McpServer, queryLayer: QueryLayer): void;
