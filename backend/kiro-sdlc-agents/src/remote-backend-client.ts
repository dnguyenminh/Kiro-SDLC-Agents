import * as vscode from "vscode";
import * as fs from "fs";
import { ServerStatus } from "./types";
import { AuthManager } from "./auth/AuthManager";
import * as http from "http";
import * as https from "https";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";

export class RemoteBackendClient implements vscode.Disposable {
  private _status: ServerStatus = "stopped";
  private _port: number | null = null;
  private _wrapperPort: number | null = null;
  private readonly _onStatusChange = new vscode.EventEmitter<ServerStatus>();
  readonly onStatusChange = this._onStatusChange.event;
  
  private mcpClient: Client | null = null;
  private httpServer: http.Server | null = null;
  private requestId = 0;
  
  private readonly _onNotification = new vscode.EventEmitter<{ method: string; params?: any }>();
  public readonly onNotification = this._onNotification.event;

  constructor(
    private readonly workspaceFolder: string,
    private readonly outputChannel: vscode.OutputChannel,
    private readonly authManager: AuthManager | undefined,
    private readonly backendUrl: string
  ) {
    this._port = this.extractPort(backendUrl);
  }

  get status(): ServerStatus {
    return this._status;
  }

  get port(): number | null {
    return this._wrapperPort || this._port;
  }

  private extractPort(url: string): number | null {
    try {
      const parsed = new URL(url);
      if (parsed.port) return parseInt(parsed.port, 10);
      return parsed.protocol === "https:" ? 443 : 80;
    } catch {
      return null;
    }
  }

  private setStatus(status: ServerStatus) {
    if (this._status !== status) {
      this._status = status;
      this._onStatusChange.fire(status);
    }
  }

  async connect(): Promise<void> {
    this.setStatus("starting");
    try {
      // Health check
      await this.checkHealth();
      
      this.mcpClient = new Client({
        name: "kiro-sdlc-extension",
        version: "2.0.0"
      }, { capabilities: {} });
      
      // Handle all generic notifications and proxy them
      this.mcpClient.fallbackNotificationHandler = async (notification) => {
        this._onNotification.fire({ method: notification.method, params: notification.params });
      };

      const url = new URL(`${this.backendUrl}/mcp`);
      const token = this.authManager?.getTokenSync();
      const requestInit: Record<string, any> = {};
      if (token) {
        requestInit.headers = {
          "Authorization": `Bearer ${token}`
        };
      }
      // Use the StreamableHTTPClientTransport matching the WebStandardStreamableHTTPServerTransport in backend
      const transport = new StreamableHTTPClientTransport(url, {
        requestInit
      });
      
      await this.mcpClient.connect(transport);
      await this.startLocalServer();

      this.setStatus("running");
      this.outputChannel.appendLine(`[RemoteBackendClient] Connected to ${this.backendUrl} via MCP Streamable Transport`);
    } catch (err: any) {
      this.setStatus("crashed");
      this.outputChannel.appendLine(`[RemoteBackendClient] Connection failed: ${err.message}`);
      throw err;
    }
  }

  private async startLocalServer(): Promise<void> {
    const config = vscode.workspace.getConfiguration("kiroSdlc");
    const port = config.get<number>("mcpServerPort", 9181);

    return new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        const url = new URL(req.url || "/", "http://localhost");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

        const p = url.pathname;
        try {
          if (p === "/mcp") { await this.handleMcpRequest(req, res); return; }
          // Dummy endpoints for legacy UI compatibility
          if (p === "/health") { res.writeHead(200, { "Content-Type": "application/json" }); res.end('{"status":"ok","mode":"wrapper"}'); return; }
          
          res.writeHead(404, { "Content-Type": "application/json" }); res.end('{"error":"Not found"}');
        } catch (err: unknown) {
          if (!res.headersSent) { res.writeHead(500, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: (err as Error).message })); }
        }
      });

      server.on("error", reject);
      server.listen(port, "127.0.0.1", () => {
        const addr = server.address() as import("net").AddressInfo;
        this._wrapperPort = addr.port;
        this.httpServer = server;
        this.outputChannel.appendLine(`[WrapperServer] Listening on local port ${this._wrapperPort}`);
        resolve();
      });
    });
  }

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", chunk => body += chunk.toString());
      req.on("end", () => resolve(body));
      req.on("error", reject);
    });
  }

  private async handleMcpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.method !== "POST") { res.writeHead(405, { Allow: "POST" }); res.end('{"error":"Method not allowed"}'); return; }
    
    const body = await this.readBody(req);
    let jsonRpc: { jsonrpc: string; id?: number; method: string; params?: Record<string, unknown> };
    try { jsonRpc = JSON.parse(body); } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end('{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error"}}');
      return;
    }

    if (jsonRpc.id === undefined) jsonRpc.id = ++this.requestId;

    if (!this.mcpClient) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: jsonRpc.id, error: { code: -32002, message: "Backend not connected" } }));
      return;
    }

    try {
      // Custom interception for tool calls
      if (jsonRpc.method === "tools/call" && jsonRpc.params) {
        const name = jsonRpc.params.name as string;
        const args = (jsonRpc.params.arguments || {}) as Record<string, unknown>;

        // Intercept local tools that shouldn't be sent to backend
        if (name === "stream_write_file" || name === "embed_image") {
          const result = await this.executeLocalTool(name, args);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ jsonrpc: "2.0", id: jsonRpc.id, result }));
          return;
        }

        jsonRpc.params.arguments = await this.wrapToolArguments(name, args);
      }

      // Proxy request to backend
      const response = await this.mcpClient.request(
        { method: jsonRpc.method, params: jsonRpc.params },
        z.any()
      );
      
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: jsonRpc.id, result: response }));
    } catch (err: any) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: jsonRpc.id, error: { code: err.code || -32603, message: err.message } }));
    }
  }

  async disconnect(): Promise<void> {
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
    }
    if (this.mcpClient) {
      await this.mcpClient.close();
      this.mcpClient = null;
    }
    this.setStatus("stopped");
    this.outputChannel.appendLine(`[RemoteBackendClient] Disconnected.`);
  }

  async spawn(): Promise<void> {
    await this.connect();
  }

  async kill(): Promise<void> {
    await this.disconnect();
  }

  async restart(): Promise<void> {
    await this.reconnect();
  }

  async reconnect(): Promise<void> {
    await this.disconnect();
    await this.connect();
  }

  private async checkHealth(): Promise<void> {
    // Simple HTTP GET to backend to ensure it's up
    return new Promise((resolve, reject) => {
      const req = (this.backendUrl.startsWith("https") ? https : http).get(`${this.backendUrl}/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`Health check failed with status ${res.statusCode}`));
        }
      });
      req.on("error", (err) => reject(err));
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error("Health check timed out"));
      });
    });
  }

  async invokeTool(name: string, args: Record<string, unknown>): Promise<string> {
    if (this._status !== "running" || !this.mcpClient) {
      throw new Error("Backend connection is not active.");
    }

    // Tool forwarding wrapper logic
    const finalArgs = await this.wrapToolArguments(name, args);

    const result = await this.mcpClient.callTool({
      name,
      arguments: finalArgs
    });
    
    if (result.isError) {
      throw new Error(`Tool execution failed: ${JSON.stringify(result.content)}`);
    }

    return JSON.stringify(result);
  }

  /**
   * Wraps specific tool arguments before forwarding to the backend.
   */
  private async wrapToolArguments(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const newArgs = { ...args };

    if (name === "mem_ingest_file") {
      const filePath = args.file_path as string;
      if (filePath) {
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          newArgs.content = content;
        } catch (err: any) {
          throw new Error(`Wrapper failed to read local file ${filePath}: ${err.message}`);
        }
      }
    }

    return newArgs;
  }

  /**
   * Execute local tools that shouldn't be forwarded to the backend.
   */
  private async executeLocalTool(name: string, args: Record<string, unknown>): Promise<any> {
    if (name === "stream_write_file") {
      const filePath = args.path as string;
      const content = args.content as string;
      const mode = args.mode as string || "write";
      
      if (!filePath || typeof content !== "string") {
        return { isError: true, content: [{ type: "text", text: "Invalid arguments for stream_write_file: 'path' and 'content' are required." }] };
      }
      
      try {
        const path = require("path");
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        if (mode === "append") {
          fs.appendFileSync(filePath, content, "utf-8");
          return { isError: false, content: [{ type: "text", text: `Successfully appended to file: ${filePath}` }] };
        } else {
          fs.writeFileSync(filePath, content, "utf-8");
          return { isError: false, content: [{ type: "text", text: `Successfully wrote file: ${filePath}` }] };
        }
      } catch (err: any) {
        return { isError: true, content: [{ type: "text", text: `Failed to write file ${filePath}: ${err.message}` }] };
      }
    }
    
    // Fallback for embed_image or other local tools if needed
    return { isError: true, content: [{ type: "text", text: `Local tool '${name}' is intercepted but not fully implemented in wrapper yet.` }] };
  }

  dispose(): void {
    this.disconnect().catch(() => {});
    this._onNotification.dispose();
    this._onStatusChange.dispose();
  }
}
