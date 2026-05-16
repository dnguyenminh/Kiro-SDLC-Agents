/**
 * code_index_status tool — Show indexing statistics and health.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { QueryLayer } from '../query/query-layer.js';
import { IndexingEngine } from '../indexer/indexing-engine.js';

export function registerCodeIndexStatus(
  server: McpServer, queryLayer: QueryLayer, indexer: IndexingEngine
): void {
  server.tool(
    'code_index_status',
    'Get current indexing status: file count, symbol count, languages, last indexed time, and indexer state.',
    {
      reindex: z.boolean().optional().default(false).describe('Trigger a full re-index'),
    },
    async ({ reindex }) => {
      if (reindex) {
        await indexer.runFullIndex();
      }
      const status = queryLayer.getIndexStatus();
      const text = formatStatus(status, indexer.isRunning());
      return { content: [{ type: 'text', text }] };
    }
  );
}

function formatStatus(status: any, isRunning: boolean): string {
  const lines = [
    '📊 Code Intelligence Index Status\n',
    `State: ${isRunning ? '🔄 Indexing...' : '✅ Idle'}`,
    `Files: ${status.totalFiles}`,
    `Symbols: ${status.totalSymbols}`,
    `Modules: ${status.totalModules}`,
    `Last indexed: ${status.lastIndexed ?? 'Never'}`,
    '',
    'Languages:',
  ];

  for (const [lang, count] of Object.entries(status.languages)) {
    lines.push(`  ${lang}: ${count} files`);
  }

  return lines.join('\n');
}
