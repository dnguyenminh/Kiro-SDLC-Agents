"use strict";
/**
 * code_search tool — Full-text search across indexed codebase using FTS5.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCodeSearch = registerCodeSearch;
const zod_1 = require("zod");
function registerCodeSearch(server, queryLayer) {
    server.tool('code_search', 'Full-text search across indexed code symbols (functions, classes, interfaces). Uses SQLite FTS5 with porter stemming.', {
        query: zod_1.z.string().describe('Search query (supports FTS5 syntax: AND, OR, NOT, prefix*)'),
        limit: zod_1.z.number().optional().default(20).describe('Max results (default 20)'),
    }, async ({ query, limit }) => {
        const results = queryLayer.searchCode(query, limit);
        const text = formatSearchResults(results, query);
        return { content: [{ type: 'text', text }] };
    });
}
function formatSearchResults(results, query) {
    if (results.length === 0) {
        return `No results found for "${query}"`;
    }
    const lines = [`Found ${results.length} results for "${query}":\n`];
    for (const r of results) {
        lines.push(`[${r.kind}] ${r.name}`);
        lines.push(`  File: ${r.filePath}:${r.startLine}`);
        if (r.signature)
            lines.push(`  Sig: ${r.signature.slice(0, 120)}`);
        if (r.docComment)
            lines.push(`  Doc: ${r.docComment.slice(0, 100)}`);
        lines.push('');
    }
    return lines.join('\n');
}
//# sourceMappingURL=code-search.js.map