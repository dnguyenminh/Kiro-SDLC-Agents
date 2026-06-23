/**
 * code_kb_export tool — Export code intelligence data as KB payloads.
 * Returns structured data ready for kb_ingest consumption.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { QueryLayer } from '../query/query-layer.js';
export declare function registerCodeKbExport(server: McpServer, queryLayer: QueryLayer, workspace: string): void;
