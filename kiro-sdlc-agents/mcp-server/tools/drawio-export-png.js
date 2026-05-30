"use strict";
/**
 * drawio_export_png — Export .drawio file to PNG image.
 * Priority: 1) draw.io CLI, 2) chrome-devtools-mcp, 3) puppeteer MCP.
 * If none available, tool is NOT published.
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
exports.DRAWIO_EXPORT_PNG_DEFINITION = void 0;
exports.detectRenderer = detectRenderer;
exports.isExportPngAvailable = isExportPngAvailable;
exports.resetRendererCache = resetRendererCache;
exports.handleDrawioExportPng = handleDrawioExportPng;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
exports.DRAWIO_EXPORT_PNG_DEFINITION = {
    name: 'drawio_export_png',
    description: 'Export a .drawio diagram file to PNG image. Returns the relative path to the exported PNG file.',
    inputSchema: {
        type: 'object',
        properties: {
            file_path: { type: 'string', description: 'Relative path to .drawio file (relative to workspace root)' },
        },
        required: ['file_path'],
    },
};
let cachedRenderer = null;
let cachedDrawioCliPath = null;
function detectRenderer(orchestrationEngine) {
    if (cachedRenderer !== null)
        return cachedRenderer;
    const cliPath = findDrawioCli();
    if (cliPath) {
        cachedDrawioCliPath = cliPath;
        cachedRenderer = 'drawio-cli';
        console.error(`[drawio-export] Renderer: draw.io CLI at ${cliPath}`);
        return cachedRenderer;
    }
    if (orchestrationEngine && hasUpstreamServer(orchestrationEngine, 'chrome-devtools-mcp')) {
        cachedRenderer = 'chrome-devtools-mcp';
        console.error('[drawio-export] Renderer: chrome-devtools-mcp (upstream)');
        return cachedRenderer;
    }
    if (orchestrationEngine && hasUpstreamServer(orchestrationEngine, 'puppeteer')) {
        cachedRenderer = 'puppeteer-mcp';
        console.error('[drawio-export] Renderer: puppeteer-mcp (upstream)');
        return cachedRenderer;
    }
    cachedRenderer = 'none';
    console.error('[drawio-export] No renderer available — tool will be hidden');
    return cachedRenderer;
}
function isExportPngAvailable(orchestrationEngine) {
    return detectRenderer(orchestrationEngine) !== 'none';
}
function resetRendererCache() {
    cachedRenderer = null;
    cachedDrawioCliPath = null;
}
async function handleDrawioExportPng(args, workspace, orchestrationEngine) {
    const rawPath = args.file_path;
    if (!rawPath)
        return jsonError('file_path is required');
    const filePath = path.isAbsolute(rawPath) ? rawPath : path.resolve(workspace, rawPath);
    if (!fs.existsSync(filePath))
        return jsonError(`File not found: ${rawPath}`);
    if (!filePath.endsWith('.drawio'))
        return jsonError('File must have .drawio extension');
    const pngPath = filePath.replace(/\.drawio$/, '.png');
    const relativePngPath = path.relative(workspace, pngPath).replace(/\\/g, '/');
    const renderer = detectRenderer(orchestrationEngine);
    try {
        switch (renderer) {
            case 'drawio-cli':
                await exportWithCli(filePath, pngPath);
                break;
            case 'chrome-devtools-mcp':
                await exportWithChrome(filePath, pngPath, workspace, orchestrationEngine);
                break;
            case 'puppeteer-mcp':
                await exportWithPuppeteer(filePath, pngPath, workspace, orchestrationEngine);
                break;
            default:
                return jsonError('No renderer available. Install draw.io desktop or configure chrome-devtools-mcp.');
        }
        if (!fs.existsSync(pngPath)) {
            return jsonError(`Export failed — PNG file was not created at ${relativePngPath}`);
        }
        const stats = fs.statSync(pngPath);
        return JSON.stringify({
            success: true,
            file_path: relativePngPath,
            size_bytes: stats.size,
            renderer: renderer,
        });
    }
    catch (e) {
        return jsonError(`Export failed: ${e.message ?? e}`);
    }
}
async function exportWithCli(inputPath, outputPath) {
    if (!cachedDrawioCliPath)
        throw new Error('draw.io CLI path not cached');
    const cmd = `"${cachedDrawioCliPath}" --export --format png --border 10 --output "${outputPath}" "${inputPath}"`;
    (0, child_process_1.execSync)(cmd, { timeout: 30000, stdio: 'pipe' });
}
async function exportWithChrome(inputPath, outputPath, _workspace, orchestrationEngine) {
    const xml = fs.readFileSync(inputPath, 'utf-8');
    const encoded = Buffer.from(xml).toString('base64');
    const viewerUrl = `https://viewer.diagrams.net/?lightbox=1&nav=0#R${encoded}`;
    await orchestrationEngine.executeUpstreamTool('chrome-devtools-mcp', 'navigate_page', {
        type: 'url', url: viewerUrl, timeout: 15000,
    });
    await sleep(3000);
    await orchestrationEngine.executeUpstreamTool('chrome-devtools-mcp', 'take_screenshot', {
        format: 'png', fullPage: true, filePath: outputPath,
    });
}
async function exportWithPuppeteer(inputPath, outputPath, _workspace, orchestrationEngine) {
    const xml = fs.readFileSync(inputPath, 'utf-8');
    const encoded = Buffer.from(xml).toString('base64');
    const viewerUrl = `https://viewer.diagrams.net/?lightbox=1&nav=0#R${encoded}`;
    await orchestrationEngine.executeUpstreamTool('puppeteer', 'navigate', { url: viewerUrl });
    await sleep(3000);
    await orchestrationEngine.executeUpstreamTool('puppeteer', 'screenshot', { path: outputPath, fullPage: true });
}
function findDrawioCli() {
    const candidates = [];
    if (process.platform === 'win32') {
        candidates.push('C:\\Program Files\\draw.io\\draw.io.exe', `${process.env.LOCALAPPDATA || ''}\\Programs\\draw.io\\draw.io.exe`, `${process.env.PROGRAMFILES || ''}\\draw.io\\draw.io.exe`);
    }
    else if (process.platform === 'darwin') {
        candidates.push('/Applications/draw.io.app/Contents/MacOS/draw.io', '/usr/local/bin/drawio', `${process.env.HOME || ''}/Applications/draw.io.app/Contents/MacOS/draw.io`);
    }
    else {
        candidates.push('/usr/bin/drawio', '/usr/local/bin/drawio', '/snap/bin/drawio', `${process.env.HOME || ''}/.local/bin/drawio`);
    }
    for (const candidate of candidates) {
        if (candidate && fs.existsSync(candidate))
            return candidate;
    }
    try {
        const which = process.platform === 'win32' ? 'where drawio 2>nul' : 'which drawio';
        const result = (0, child_process_1.execSync)(which, { timeout: 5000, stdio: 'pipe' }).toString().trim();
        if (result && fs.existsSync(result.split('\n')[0]))
            return result.split('\n')[0];
    }
    catch { /* not in PATH */ }
    return null;
}
function hasUpstreamServer(orchestrationEngine, serverName) {
    try {
        const status = orchestrationEngine.getStatus?.();
        if (!status?.servers)
            return false;
        return status.servers.some((s) => s.name?.toLowerCase().includes(serverName.toLowerCase()) && s.state === 'ACTIVE');
    }
    catch { return false; }
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function jsonError(msg) {
    return JSON.stringify({ success: false, error: msg });
}
//# sourceMappingURL=drawio-export-png.js.map
