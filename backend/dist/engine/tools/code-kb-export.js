/**
 * code_kb_export tool — Export code intelligence data as KB payloads.
 * Returns structured data ready for kb_ingest consumption.
 */
import { z } from 'zod';
export function registerCodeKbExport(server, queryLayer, workspace) {
    server.tool('code_kb_export', 'Export code intelligence data as Knowledge Base payloads for ingestion. Returns structured data ready for kb_ingest.', {
        module: z.string().optional().describe('Filter by module name (optional, exports all if omitted)'),
        format: z.string().optional().describe('Output format: json (default) or text'),
    }, async ({ module, format }) => {
        const modules = queryLayer.listModulesWithPatterns(module ?? null);
        const projectName = extractProjectName(workspace);
        const outputFormat = format ?? 'json';
        const text = outputFormat === 'text'
            ? formatAsText(modules, projectName)
            : formatAsJson(modules, projectName);
        return { content: [{ type: 'text', text }] };
    });
}
function extractProjectName(workspace) {
    const parts = workspace.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || 'unknown';
}
function buildPayload(m, projectName) {
    const contentLines = [
        `Module: ${m.name}`,
        `Language: ${m.language ?? 'unknown'}`,
        `Purpose: ${m.purpose ?? 'unknown'}`,
        `Files: ${m.fileCount}`,
        `Symbols: ${m.symbolCount}`,
        '',
        'Patterns:',
        `  DI Style: ${m.diStyle ?? 'unknown'}`,
        `  Error Handling: ${m.errorHandling ?? 'unknown'}`,
        `  Naming: ${m.namingConvention ?? 'unknown'}`,
        `  Logging: ${m.loggingFramework ?? 'unknown'}`,
        `  Testing: ${m.testingFramework ?? 'unknown'}`,
    ];
    const tags = ['code-index', m.name, m.language ?? 'unknown'].join(', ');
    return {
        title: `Code Index — ${m.name}`,
        content: contentLines.join('\n'),
        tags,
        project: projectName,
    };
}
function formatAsJson(modules, projectName) {
    if (modules.length === 0)
        return '[]';
    const payloads = modules.map(m => buildPayload(m, projectName));
    return JSON.stringify(payloads, null, 2);
}
function formatAsText(modules, projectName) {
    if (modules.length === 0)
        return 'No modules indexed yet. Run indexing first.';
    const payloads = modules.map(m => buildPayload(m, projectName));
    const lines = [];
    for (const p of payloads) {
        lines.push(`--- ${p.title} ---`);
        lines.push(p.content);
        lines.push(`Tags: ${p.tags}`);
        lines.push(`Project: ${p.project}`);
        lines.push('');
    }
    return lines.join('\n');
}
//# sourceMappingURL=code-kb-export.js.map