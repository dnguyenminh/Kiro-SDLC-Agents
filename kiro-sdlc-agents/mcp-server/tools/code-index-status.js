"use strict";
/**
 * code_index_status tool — Show indexing statistics and health.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCodeIndexStatus = registerCodeIndexStatus;
const zod_1 = require("zod");
function registerCodeIndexStatus(server, queryLayer, indexer) {
    server.tool('code_index_status', 'Get current indexing status: file count, symbol count, languages, last indexed time, and indexer state.', {
        reindex: zod_1.z.boolean().optional().default(false).describe('Trigger a full re-index'),
    }, async ({ reindex }) => {
        if (reindex) {
            await indexer.runFullIndex();
        }
        const status = queryLayer.getIndexStatus();
        const text = formatStatus(status, indexer.isRunning());
        return { content: [{ type: 'text', text }] };
    });
}
function formatStatus(status, isRunning) {
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
//# sourceMappingURL=code-index-status.js.map