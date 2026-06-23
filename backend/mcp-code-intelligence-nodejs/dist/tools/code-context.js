"use strict";
/**
 * code_context tool — Get surrounding context for a symbol or file region.
 * Reads actual source code lines around a symbol definition.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCodeContext = registerCodeContext;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const zod_1 = require("zod");
function registerCodeContext(server, queryLayer, workspace) {
    server.tool('code_context', 'Get source code context around a symbol or line range. Returns actual code lines from the file.', {
        file: zod_1.z.string().describe('Relative file path'),
        symbol: zod_1.z.string().optional().describe('Symbol name to find in file'),
        startLine: zod_1.z.number().optional().describe('Start line (1-based)'),
        endLine: zod_1.z.number().optional().describe('End line (1-based)'),
        contextLines: zod_1.z.number().optional().default(5).describe('Extra lines above/below'),
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