/**
 * code_context tool — Get surrounding context for a symbol or file region.
 * Reads actual source code lines around a symbol definition.
 */
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
export function registerCodeContext(server, queryLayer, workspace) {
    server.tool('code_context', 'Get source code context around a symbol or line range. Returns actual code lines from the file.', {
        file: z.string().describe('Relative file path'),
        symbol: z.string().optional().describe('Symbol name to find in file'),
        startLine: z.number().optional().describe('Start line (1-based)'),
        endLine: z.number().optional().describe('End line (1-based)'),
        contextLines: z.number().optional().default(5).describe('Extra lines above/below'),
    }, async ({ file, symbol, startLine, endLine, contextLines }) => {
        const text = getContext(workspace, file, symbol, startLine, endLine, contextLines, queryLayer);
        return { content: [{ type: 'text', text }] };
    });
}
function getContext(workspace, file, symbol, startLine, endLine, contextLines, queryLayer) {
    const fullPath = path.resolve(workspace, file);
    if (!fs.existsSync(fullPath))
        return `File not found: ${file}`;
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    if (symbol) {
        return getSymbolContext(file, symbol, lines, contextLines, queryLayer);
    }
    const start = Math.max(0, (startLine ?? 1) - 1 - contextLines);
    const end = Math.min(lines.length, (endLine ?? startLine ?? lines.length) + contextLines);
    return formatLines(lines, start, end, file);
}
function getSymbolContext(file, symbol, lines, contextLines, queryLayer) {
    const symbols = queryLayer.getFileSymbols(file);
    const match = symbols.find(s => s.name === symbol);
    if (!match)
        return `Symbol "${symbol}" not found in ${file}`;
    const start = Math.max(0, match.startLine - 1 - contextLines);
    const end = Math.min(lines.length, match.endLine + contextLines);
    return formatLines(lines, start, end, file);
}
function formatLines(lines, start, end, file) {
    const numbered = lines
        .slice(start, end)
        .map((line, i) => `${String(start + i + 1).padStart(4)} | ${line}`);
    return `// ${file} [${start + 1}-${end}]\n${numbered.join('\n')}`;
}
//# sourceMappingURL=code-context.js.map