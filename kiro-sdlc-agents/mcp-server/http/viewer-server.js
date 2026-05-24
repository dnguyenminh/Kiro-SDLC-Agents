"use strict";
/**
 * HTTP server for Knowledge Graph viewer — uses Node.js built-in http module.
 * All HTML/CSS/JS served from shared/viewer/ (single source of truth).
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
exports.ViewerServer = void 0;
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const api_routes_js_1 = require("./api-routes.js");
const ingest_routes_js_1 = require("./ingest-routes.js");
const ux_routes_js_1 = require("./ux-routes.js");
const model_routes_js_1 = require("./model-routes.js");
class ViewerServer {
    server = null;
    port;
    /** Late-binding — set after MCP initialize completes. */
    memoryEngine = null;
    knowledgeGraph = null;
    modelManager = null;
    workspace = '';
    constructor(port, workspace = '') {
        this.port = port;
        this.workspace = workspace;
    }
    start() {
        this.server = http.createServer((req, res) => this.handleRequest(req, res));
        this.server.listen(this.port, () => {
            const addr = this.server.address();
            const actualPort = addr?.port ?? this.port;
            this.port = actualPort;
            console.error(`[code-intel] HTTP viewer starting on port ${actualPort}`);
        });
    }
    stop() {
        this.server?.close();
        this.server = null;
    }
    handleRequest(req, res) {
        const url = new URL(req.url ?? '/', `http://localhost:${this.port}`);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
        if (url.pathname === '/') {
            this.serveSharedFile(res, 'index.html', 'text/html');
        }
        else if (url.pathname === '/dashboard') {
            this.serveSharedFile(res, 'dashboard.html', 'text/html');
        }
        else if (url.pathname === '/tags') {
            this.serveSharedFile(res, 'tags.html', 'text/html');
        }
        else if (url.pathname === '/quality') {
            this.serveSharedFile(res, 'quality.html', 'text/html');
        }
        else if (url.pathname === '/analytics') {
            this.serveSharedFile(res, 'analytics.html', 'text/html');
        }
        else if (url.pathname.startsWith('/modules/') || url.pathname.startsWith('/config/')) {
            this.serveSubdirStatic(url.pathname, res);
        }
        else if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
            this.serveStatic(url.pathname, res);
        }
        else if (url.pathname === '/api/health') {
            this.serveHealth(res);
        }
        else if (url.pathname.startsWith('/api/models')) {
            if (!(0, model_routes_js_1.handleModelRoute)(req, url, res, this.modelManager)) {
                this.send404(res);
            }
        }
        else if (url.pathname.startsWith('/api/kb')) {
            const db = this.memoryEngine?.db ?? null;
            if (!(0, ux_routes_js_1.handleUxRoute)(req, url, res, this.memoryEngine, db)) {
                this.send404(res);
            }
        }
        else if (url.pathname.startsWith('/api/memory')) {
            if (req.method === 'POST') {
                (0, ingest_routes_js_1.handleIngestFileRoute)(req, url, res, this.memoryEngine, this.workspace);
            }
            else {
                (0, api_routes_js_1.handleApiRoute)(url, res, this.memoryEngine, this.knowledgeGraph);
            }
        }
        else {
            this.send404(res);
        }
    }
    serveSharedFile(res, filename, contentType) {
        const filePath = this.resolveSharedPath(filename);
        if (!filePath) {
            this.serveViewerError(res, filename);
            return;
        }
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            res.writeHead(200, { 'Content-Type': `${contentType}; charset=utf-8` });
            res.end(content);
        }
        catch {
            this.serveViewerError(res, filename);
        }
    }
    serveSubdirStatic(pathname, res) {
        if (pathname.includes('..')) {
            this.send404(res);
            return;
        }
        const relPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
        const filePath = this.resolveSharedPath(relPath);
        if (!filePath) {
            this.send404(res);
            return;
        }
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const ct = pathname.endsWith('.json') ? 'application/json'
                : pathname.endsWith('.css') ? 'text/css' : 'application/javascript';
            res.writeHead(200, { 'Content-Type': ct + '; charset=utf-8' });
            res.end(content);
        }
        catch {
            this.send404(res);
        }
    }
    serveStatic(pathname, res) {
        const filename = path.basename(pathname);
        if (filename.includes('..')) {
            this.send404(res);
            return;
        }
        const filePath = this.resolveSharedPath(filename);
        if (!filePath) {
            this.send404(res);
            return;
        }
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const ct = filename.endsWith('.css') ? 'text/css' : 'application/javascript';
            res.writeHead(200, {
                'Content-Type': ct + '; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
            });
            res.end(content);
        }
        catch {
            this.send404(res);
        }
    }
    /** Resolve path within viewer/. Checks bundled dist/viewer/ first, then workspace shared/viewer/. */
    resolveSharedPath(relPath) {
        // 1. Bundled viewer (inside npm package: dist/viewer/)
        const bundledPath = path.join(__dirname, '..', 'viewer', relPath);
        if (fs.existsSync(bundledPath))
            return bundledPath;
        // 2. Fallback: workspace shared/viewer/ (dev mode)
        if (this.workspace) {
            const wsPath = path.join(this.workspace, 'shared', 'viewer', relPath);
            if (fs.existsSync(wsPath))
                return wsPath;
        }
        return null;
    }
    /** Error page when shared/viewer/ files are missing. */
    serveViewerError(res, filename) {
        const html = `<!DOCTYPE html><html><head><title>Viewer Unavailable</title></head>`
            + `<body style="background:#0f172a;color:#e2e8f0;font-family:system-ui;padding:2rem">`
            + `<h1>Viewer Unavailable</h1>`
            + `<p>shared/viewer/${filename} not found. Please ensure workspace is correct.</p>`
            + `<p style="opacity:.6;font-size:.8rem">Workspace: ${this.workspace || '(not set)'}</p>`
            + `</body></html>`;
        res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
    }
    serveHealth(res) {
        this.sendJson(res, {
            status: 'ok',
            version: '0.2.0',
            workspace: this.workspace,
            viewerPort: this.port,
            memoryEnabled: this.memoryEngine !== null,
        });
    }
    send404(res) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
    sendJson(res, data) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }
}
exports.ViewerServer = ViewerServer;
//# sourceMappingURL=viewer-server.js.map