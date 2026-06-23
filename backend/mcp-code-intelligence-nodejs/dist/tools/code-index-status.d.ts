/**
 * code_index_status tool — Show indexing statistics and health.
 * KSA-191: Enhanced with SFDX stats section when Salesforce project detected.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { QueryLayer } from '../query/query-layer.js';
import { IndexingEngine } from '../indexer/indexing-engine.js';
export declare function registerCodeIndexStatus(server: McpServer, queryLayer: QueryLayer, indexer: IndexingEngine): void;
//# sourceMappingURL=code-index-status.d.ts.map