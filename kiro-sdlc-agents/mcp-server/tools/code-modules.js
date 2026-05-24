"use strict";
/**
 * code_modules tool — List discovered modules with file/symbol counts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCodeModules = registerCodeModules;
const zod_1 = require("zod");
function registerCodeModules(server, queryLayer) {
    server.tool('code_modules', 'List all discovered code modules in the workspace with file counts, languages, and descriptions.', {
        name: zod_1.z.string().optional().describe('Filter by module name (prefix match)'),
    }, async ({ name }) => {
        const modules = queryLayer.listModules();
        const filtered = name
            ? modules.filter(m => m.name.toLowerCase().startsWith(name.toLowerCase()))
            : modules;
        const text = formatModules(filtered);
        return { content: [{ type: 'text', text }] };
    });
}
function formatModules(modules) {
    if (modules.length === 0)
        return 'No modules indexed yet. Run indexing first.';
    const lines = [`Modules (${modules.length}):\n`];
    for (const m of modules) {
        lines.push(`📦 ${m.name}`);
        lines.push(`   Path: ${m.rootPath}`);
        if (m.language)
            lines.push(`   Lang: ${m.language}`);
        lines.push(`   Files: ${m.fileCount} | Symbols: ${m.symbolCount}`);
        const patterns = formatPatterns(m);
        if (patterns)
            lines.push(`   Patterns: ${patterns}`);
        if (m.purpose)
            lines.push(`   Purpose: ${m.purpose}`);
        if (m.description)
            lines.push(`   ${m.description}`);
        lines.push('');
    }
    return lines.join('\n');
}
function formatPatterns(m) {
    const parts = [];
    if (m.diStyle)
        parts.push(`DI=${m.diStyle}`);
    if (m.errorHandling)
        parts.push(`Errors=${m.errorHandling}`);
    if (m.namingConvention)
        parts.push(`Naming=${m.namingConvention}`);
    if (m.loggingFramework)
        parts.push(`Logging=${m.loggingFramework}`);
    if (m.testingFramework)
        parts.push(`Testing=${m.testingFramework}`);
    return parts.join(' | ');
}
//# sourceMappingURL=code-modules.js.map