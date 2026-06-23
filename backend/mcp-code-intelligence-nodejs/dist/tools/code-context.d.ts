/**
 * code_context tool — Get surrounding context for a symbol or file region.
 * Reads actual source code lines around a symbol definition.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { QueryLayer } from '../query/query-layer.js';
export declare function registerCodeContext(server: McpServer, queryLayer: QueryLayer, workspace: string): void;
//# sourceMappingURL=code-context.d.ts.map