/**
 * HTTP server for Knowledge Graph viewer — uses Node.js built-in http module.
 * Port of Kotlin ViewerServer.kt + MemoryApiRoutes.kt.
 */

import * as http from 'http';
import { VIEWER_HTML } from './viewer-html.js';
import { MemoryEngine } from '../memory/memory-engine.js';
import { KnowledgeGraph } from '../memory/knowledge-graph.js';
import { handleApiRoute } from './api-routes.js';

export class ViewerServer {
  private server: http.Server | null = null;
  private port: number;

  /** Late-binding — set after MCP initialize completes. */
  memoryEngine: MemoryEngine | null = null;
  knowledgeGraph: KnowledgeGraph | null = null;

  constructor(port: number) {
    this.port = port;
  }

  /** Start HTTP server (non-blocking). */
  start(): void {
    this.server = http.createServer((req, res) => this.handleRequest(req, res));
    this.server.listen(this.port, () => {
      console.error(`[code-intel] HTTP viewer starting on port ${this.port}`);
    });
  }

  /** Stop the server gracefully. */
  stop(): void {
    this.server?.close();
    this.server = null;
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url ?? '/', `http://localhost:${this.port}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (url.pathname === '/') {
      this.serveHtml(res);
    } else if (url.pathname === '/api/health') {
      this.serveHealth(res);
    } else if (url.pathname.startsWith('/api/memory')) {
      handleApiRoute(url, res, this.memoryEngine, this.knowledgeGraph);
    } else {
      this.send404(res);
    }
  }

  private serveHtml(res: http.ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(VIEWER_HTML);
  }

  private serveHealth(res: http.ServerResponse): void {
    this.sendJson(res, {
      status: 'ok',
      version: '0.1.0',
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
