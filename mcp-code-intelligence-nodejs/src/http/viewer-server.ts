/**
 * HTTP server for Knowledge Graph viewer — uses Node.js built-in http module.
 * All HTML/CSS/JS served from shared/viewer/ (single source of truth).
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { MemoryEngine } from '../memory/memory-engine.js';
import { KnowledgeGraph } from '../memory/knowledge-graph.js';
import { handleApiRoute } from './api-routes.js';
import { handleIngestFileRoute } from './ingest-routes.js';
import { handleUxRoute } from './ux-routes.js';
import { handleModelRoute } from './model-routes.js';
import { ModelManager } from '../orchestration/models/model-manager.js';

export class ViewerServer {
  private server: http.Server | null = null;
  private port: number;

  /** Late-binding — set after MCP initialize completes. */
  memoryEngine: MemoryEngine | null = null;
  knowledgeGraph: KnowledgeGraph | null = null;
  modelManager: ModelManager | null = null;
  workspace: string = '';

  constructor(port: number, workspace: string = '') {
    this.port = port;
    this.workspace = workspace;
  }

  start(): void {
    this.server = http.createServer((req, res) => this.handleRequest(req, res));
    this.server.listen(this.port, () => {
      const addr = this.server!.address() as any;
      const actualPort = addr?.port ?? this.port;
      this.port = actualPort;
      console.error(`[code-intel] HTTP viewer starting on port ${actualPort}`);
    });
  }

  stop(): void {
    this.server?.close();
    this.server = null;
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url ?? '/', `http://localhost:${this.port}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    if (url.pathname === '/') {
      this.serveSharedFile(res, 'index.html', 'text/html');
    } else if (url.pathname === '/dashboard') {
      this.serveSharedFile(res, 'dashboard.html', 'text/html');
    } else if (url.pathname === '/tags') {
      this.serveSharedFile(res, 'tags.html', 'text/html');
    } else if (url.pathname === '/quality') {
      this.serveSharedFile(res, 'quality.html', 'text/html');
    } else if (url.pathname === '/analytics') {
      this.serveSharedFile(res, 'analytics.html', 'text/html');
    } else if (url.pathname.startsWith('/modules/') || url.pathname.startsWith('/config/')) {
      this.serveSubdirStatic(url.pathname, res);
    } else if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
      this.serveStatic(url.pathname, res);
    } else if (url.pathname === '/api/health') {
      this.serveHealth(res);
    } else if (url.pathname.startsWith('/api/models')) {
      if (!handleModelRoute(req, url, res, this.modelManager)) {
        this.send404(res);
      }
    } else if (url.pathname.startsWith('/api/kb')) {
      const db = this.memoryEngine?.db ?? null;
      if (!handleUxRoute(req, url, res, this.memoryEngine, db)) {
        this.send404(res);
      }
    } else if (url.pathname.startsWith('/api/memory')) {
      if (req.method === 'POST') {
        handleIngestFileRoute(req, url, res, this.memoryEngine, this.workspace);
      } else {
        handleApiRoute(url, res, this.memoryEngine, this.knowledgeGraph);
      }
    } else {
      this.send404(res);
    }
  }

  private serveSharedFile(res: http.ServerResponse, filename: string, contentType: string): void {
    const filePath = this.resolveSharedPath(filename);
    if (!filePath) { this.serveViewerError(res, filename); return; }
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': `${contentType}; charset=utf-8` });
      res.end(content);
    } catch { this.serveViewerError(res, filename); }
  }

  private serveSubdirStatic(pathname: string, res: http.ServerResponse): void {
    if (pathname.includes('..')) { this.send404(res); return; }
    const relPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
    const filePath = this.resolveSharedPath(relPath);
    if (!filePath) { this.send404(res); return; }
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const ct = pathname.endsWith('.json') ? 'application/json'
        : pathname.endsWith('.css') ? 'text/css' : 'application/javascript';
      res.writeHead(200, { 'Content-Type': ct + '; charset=utf-8' });
      res.end(content);
    } catch { this.send404(res); }
  }

  private serveStatic(pathname: string, res: http.ServerResponse): void {
    const filename = path.basename(pathname);
    if (filename.includes('..')) { this.send404(res); return; }
    const filePath = this.resolveSharedPath(filename);
    if (!filePath) { this.send404(res); return; }
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const ct = filename.endsWith('.css') ? 'text/css' : 'application/javascript';
      res.writeHead(200, {
        'Content-Type': ct + '; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      });
      res.end(content);
    } catch { this.send404(res); }
  }

  /** Resolve path within viewer/. Checks bundled dist/viewer/ first, then workspace shared/viewer/. */
  private resolveSharedPath(relPath: string): string | null {
    // 1. Bundled viewer (inside npm package: dist/viewer/)
    const bundledPath = path.join(__dirname, '..', 'viewer', relPath);
    if (fs.existsSync(bundledPath)) return bundledPath;
    // 2. Fallback: workspace shared/viewer/ (dev mode)
    if (this.workspace) {
      const wsPath = path.join(this.workspace, 'shared', 'viewer', relPath);
      if (fs.existsSync(wsPath)) return wsPath;
    }
    return null;
  }

  /** Error page when shared/viewer/ files are missing. */
  private serveViewerError(res: http.ServerResponse, filename: string): void {
    const html = `<!DOCTYPE html><html><head><title>Viewer Unavailable</title></head>`
      + `<body style="background:#0f172a;color:#e2e8f0;font-family:system-ui;padding:2rem">`
      + `<h1>Viewer Unavailable</h1>`
      + `<p>shared/viewer/${filename} not found. Please ensure workspace is correct.</p>`
      + `<p style="opacity:.6;font-size:.8rem">Workspace: ${this.workspace || '(not set)'}</p>`
      + `</body></html>`;
    res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }

  private serveHealth(res: http.ServerResponse): void {
    this.sendJson(res, {
      status: 'ok',
      version: '0.2.0',
      workspace: this.workspace,
      viewerPort: this.port,
      memoryEnabled: this.memoryEngine !== null,
    });
  }

  private send404(res: http.ServerResponse): void {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  private sendJson(res: http.ServerResponse, data: unknown): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }
}
