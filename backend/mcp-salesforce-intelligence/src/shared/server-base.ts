/**
 * Base MCP server implementation using stdio JSON-RPC 2.0 transport.
 * All 3 servers (sf-parser, sf-graph, sf-kb-indexer) extend this class.
 */

import * as readline from 'readline';
import type { ToolDefinition } from './types.js';
import { SfToolError } from './errors.js';

const PROTOCOL_VERSION = '2024-11-05';

export abstract class ServerBase {
  protected workspace: string = '';

  constructor(
    protected readonly serverName: string,
    protected readonly tools: ToolDefinition[]
  ) {}

  async start(): Promise<void> {
    console.error(`[${this.serverName}] Starting (workspace deferred until initialize)`);
    const rl = readline.createInterface({ input: process.stdin, terminal: false });

    for await (const line of rl) {
      if (!line.trim()) continue;
      let request: any;
      try {
        request = JSON.parse(line);
      } catch {
        this.send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
        continue;
      }

      const { method, id, params } = request;

      // Skip notifications (no id)
      if (id === null && method?.startsWith('notifications/')) continue;

      if (method === 'initialize') {
        this.workspace = this.extractRootUri(params) ?? process.cwd();
        console.error(`[${this.serverName}] Workspace: ${this.workspace}`);
        this.send({ jsonrpc: '2.0', id, result: this.buildInitResult() });
        await this.onInitialize();
        continue;
      }

      if (method === 'tools/list') {
        this.send({ jsonrpc: '2.0', id, result: { tools: this.tools } });
        continue;
      }

      if (method === 'tools/call') {
        try {
          const text = await this.dispatchTool(params.name, params.arguments ?? {});
          this.send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } });
        } catch (err) {
          if (err instanceof SfToolError) {
            this.send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: err.toJSON() }] } });
          } else {
            console.error(`[${this.serverName}] Unexpected error:`, err);
            const msg = JSON.stringify({ error: 'INTERNAL', message: `Internal error: ${(err as Error).message}` });
            this.send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: msg }] } });
          }
        }
        continue;
      }

      if (method === 'ping') {
        this.send({ jsonrpc: '2.0', id, result: {} });
        continue;
      }

      this.send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
    }
  }

  protected abstract dispatchTool(name: string, args: Record<string, unknown>): Promise<string>;

  /** Override in subclass for post-initialize setup */
  protected async onInitialize(): Promise<void> { /* no-op */ }

  protected extractRootUri(params: any): string | null {
    const roots = params?.roots;
    if (Array.isArray(roots) && roots.length > 0 && roots[0]?.uri) {
      const uri = roots[0].uri as string;
      if (uri.startsWith('file:///')) {
        const decoded = decodeURIComponent(uri.slice(8));
        return decoded.replace(/\//g, '\\');
      }
      if (uri.startsWith('file://')) {
        return decodeURIComponent(uri.slice(7));
      }
      return uri;
    }
    return null;
  }

  private buildInitResult(): object {
    return {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: this.serverName, version: '1.0.0' },
    };
  }

  protected send(response: any): void {
    process.stdout.write(JSON.stringify(response) + '\n');
  }
}
