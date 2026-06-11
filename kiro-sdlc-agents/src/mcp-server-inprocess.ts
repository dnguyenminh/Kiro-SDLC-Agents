"use strict";

/**
 * McpServerInProcess — Runs the MCP Code Intelligence server IN-PROCESS.
 *
 * KSA-260: Instead of spawning child processes (which depend on system Node.js),
 * this directly requires and runs the MCP server logic within the extension host.
 * Benefits:
 *  - No external Node.js dependency (uses Kiro IDE's built-in runtime)
 *  - Single process = less memory, faster startup
 *  - No NODE_MODULE_VERSION mismatch issues
 *  - Native addons load in the same V8 isolate
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as http from "http";
import * as net from "net";
import {
  ServerStatus,
  IServerManager,
  McpRequest,
  McpResponse,
  McpServerNotRunningError,
  McpTimeoutError,
  McpBundleMissingError,
  SERVER_CONSTANTS,
} from "./types";
import { NativeAddonManager } from "./native-addon-manager";
import { OnnxAddonManager } from "./onnx-addon-manager";

/**
 * In-process server state. Holds references to the MCP engine internals
 * loaded from `mcp-server/index.js`.
 */
interface McpEngine {
  handleRequest(method: string, id: number, params: Record<string, unknown>): Promise<McpJsonRpcResponse | null>;
  cleanup(): void;
}

interface McpJsonRpcResponse {
  jsonrpc: "2.0";
  id: number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

export class McpServerManager implements IServerManager, vscode.Disposable {
  private _status: ServerStatus = "stopped";
  private _port: number | null = null;
  private httpServer: http.Server | null = null;
  private engine: McpEngine | null = null;
  private nativeAddonManager: NativeAddonManager | undefined;
  private onnxAddonManager: OnnxAddonManager | undefined;
  private requestId = 0;
  private isDisposing = false;

  // SSE connections for real-time panel updates
  private sseConnections = new Set<http.ServerResponse>();

  private readonly _onStatusChange = new vscode.EventEmitter<ServerStatus>();
  readonly onStatusChange = this._onStatusChange.event;

  constructor(
    private readonly extensionPath: string,
    private readonly workspaceFolder: string,
    private readonly outputChannel: vscode.OutputChannel
  ) {}

  setNativeAddonManager(manager: NativeAddonManager): void {
    this.nativeAddonManager = manager;
  }

  setOnnxAddonManager(manager: OnnxAddonManager): void {
    this.onnxAddonManager = manager;
  }

  get status(): ServerStatus {
    return this._status;
  }

  get pid(): number | null {
    // In-process — PID is extension host's PID
    return process.pid;
  }

  get port(): number | null {
    return this._port;
  }

  get viewerPort(): number | null {
    return this._port;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async spawn(): Promise<void> {
    if (this._status === "running") {
      return;
    }

    this.setStatus("starting");

    const configuredPort = this.getConfiguredPort();

    // Check if port is already in use → external server running
    if (await this.isPortListening(configuredPort)) {
      this.outputChannel.appendLine(`[MCP-InProcess] Port ${configuredPort} already in use — connecting to existing server.`);
      this._port = configuredPort;
      this.setStatus("running");
      this.updateMcpJson();
      return;
    }

    // Ensure native addon is available
    let nativeBindingPath: string | undefined;
    if (this.nativeAddonManager) {
      const addonPath = await this.nativeAddonManager.ensure();
      if (!addonPath) {
        this.setStatus("stopped");
        this.outputChannel.appendLine("[MCP-InProcess] Native addon unavailable. Server not started.");
        return;
      }
      nativeBindingPath = addonPath;
      this.outputChannel.appendLine(`[MCP-InProcess] Native addon resolved: ${addonPath}`);
    }

    // Ensure ONNX Runtime is available (optional)
    let onnxRuntimePath: string | undefined;
    if (this.onnxAddonManager) {
      const onnxPath = await this.onnxAddonManager.ensure();
      if (onnxPath) {
        onnxRuntimePath = onnxPath;
        this.outputChannel.appendLine(`[MCP-InProcess] ONNX Runtime resolved: ${onnxPath}`);
      } else {
        this.outputChannel.appendLine("[MCP-InProcess] ONNX Runtime unavailable — embedding features disabled.");
      }
    }

    // Verify bundle exists
    const serverDir = path.join(this.extensionPath, "mcp-server");
    const indexPath = path.join(serverDir, "index.js");
    if (!fs.existsSync(indexPath)) {
      this.setStatus("stopped");
      throw new McpBundleMissingError();
    }

    // Set environment variables BEFORE requiring the module
    if (nativeBindingPath) {
      process.env.BETTER_SQLITE3_BINDING = nativeBindingPath;
    }
    if (onnxRuntimePath) {
      process.env.ONNX_RUNTIME_PATH = onnxRuntimePath;
      // Add ONNX parent dir to NODE_PATH for resolution
      const onnxParent = path.dirname(onnxRuntimePath);
      process.env.NODE_PATH = [onnxParent, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("module").Module._initPaths();
    }
    process.env.DISABLE_VIEWER = "1";
    process.env.CODE_INTEL_VIEWER_PORT = "0";

    this.outputChannel.appendLine(`[MCP-InProcess] Loading MCP engine in-process (Node ${process.versions.node})...`);

    try {
      // Load the MCP engine modules directly
      this.engine = await this.loadEngine(serverDir);

      // Start HTTP server
      await this.startHttpServer(configuredPort, serverDir);

      this.setStatus("running");
      this.outputChannel.appendLine(`[MCP-InProcess] Server running in-process on port ${this._port} (PID: ${process.pid})`);
      this.updateMcpJson();
    } catch (err: unknown) {
      this.setStatus("crashed");
      const msg = (err as Error).message || String(err);
      this.outputChannel.appendLine(`[MCP-InProcess] Failed to start: ${msg}`);
      throw err;
    }
  }

  async kill(): Promise<void> {
    this.outputChannel.appendLine("[MCP-InProcess] Stopping server...");

    // Close all SSE connections
    for (const res of this.sseConnections) {
      try { res.end(); } catch { /* ignore */ }
    }
    this.sseConnections.clear();

    // Close HTTP server
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
        setTimeout(() => resolve(), 3000);
      });
      this.httpServer = null;
    }

    // Cleanup engine
    if (this.engine) {
      try { this.engine.cleanup(); } catch { /* ignore */ }
      this.engine = null;
    }

    this._port = null;
    this.setStatus("stopped");
  }

  async restart(): Promise<void> {
    this.outputChannel.appendLine("[MCP-InProcess] Restarting...");
    await this.kill();
    await this.spawn();
  }

  async invokeTool(name: string, args: Record<string, unknown>): Promise<string> {
    if (this._status !== "running" || !this._port) {
      throw new McpServerNotRunningError();
    }

    // Direct in-process call — no HTTP roundtrip needed!
    if (this.engine) {
      const response = await this.engine.handleRequest("tools/call", ++this.requestId, { name, arguments: args });
      if (response?.error) {
        throw new Error(`MCP error (${response.error.code}): ${response.error.message}`);
      }
      const result = response?.result as { content?: Array<{ type: string; text: string }> } | undefined;
      return result?.content?.[0]?.text ?? "";
    }

    // Fallback: HTTP call (if engine not loaded but port is open — external server)
    return this.invokeToolViaHttp(name, args);
  }

  dispose(): void {
    this.isDisposing = true;
    this.kill().catch(() => {});
    this._onStatusChange.dispose();
  }

  // ─── Private: Engine Loading ───────────────────────────────────────────────

  private async loadEngine(serverDir: string): Promise<McpEngine> {
    const configMod = require(path.join(serverDir, "config.js"));
    const dbMod = require(path.join(serverDir, "db", "database-manager.js"));
    const indexerMod = require(path.join(serverDir, "indexer", "indexing-engine.js"));
    const toolsMod = require(path.join(serverDir, "tools", "register-tools.js"));
    const toolCallIngestMod = require(path.join(serverDir, "tools", "tool-call-ingest.js"));
    const memoryMod = require(path.join(serverDir, "memory", "memory-engine.js"));
    const embeddingMod = require(path.join(serverDir, "memory", "embedding", "index.js"));
    const orchConfigMod = require(path.join(serverDir, "orchestration", "config.js"));
    const orchEngineMod = require(path.join(serverDir, "orchestration", "engine.js"));

    // Pre-resolve native binding
    await dbMod.DatabaseManager.preResolveBinding();

    // Load config with workspace
    let config = configMod.loadConfig();
    config = configMod.setWorkspace(config, this.workspaceFolder);
    this.outputChannel.appendLine(`[MCP-InProcess] Workspace: ${config.workspace}`);
    this.outputChannel.appendLine(`[MCP-InProcess] DB path: ${config.dbPath}`);

    // Initialize DB
    const db = new dbMod.DatabaseManager(config.dbPath);
    db.initialize();

    // Initialize indexer
    const indexer = new indexerMod.IndexingEngine(db, config);

    // Initialize memory engine
    const memEngine = new memoryMod.MemoryEngine(db.getDb());
    memEngine.startSession("kiro-extension-host");

    // Initialize embedding
    const embeddingService = embeddingMod.EmbeddingFactory.create(config, memEngine.vectors);
    this.outputChannel.appendLine(
      embeddingService
        ? "[MCP-InProcess] EmbeddingService initialized — vectors enabled"
        : "[MCP-InProcess] EmbeddingService not available — using BM25 only"
    );

    // Initialize memory dispatcher
    toolsMod.initMemoryDispatcher(memEngine, config.workspace, embeddingService);
    const memDispatcher = toolsMod.getMemoryDispatcherInstance();
    if (memDispatcher) {
      toolCallIngestMod.setIngestDispatcher(memDispatcher);
    }

    // Initialize orchestration
    const ocp = configMod.resolveOrchestrationConfigPath();
    const oc = ocp
      ? orchConfigMod.loadOrchestrationConfigFromPath(ocp)
      : orchConfigMod.loadOrchestrationConfig(config.workspace);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orchEngine: any = null;
    if (oc) {
      orchEngine = new orchEngineMod.OrchestrationEngine(oc, memEngine, config);
      await orchEngine.start();
      toolsMod.initOrchestration(orchEngine);
      this.outputChannel.appendLine("[MCP-InProcess] OrchestrationEngine started");
    } else {
      this.outputChannel.appendLine("[MCP-InProcess] No orchestration.json — orchestration disabled");
    }

    // Background indexing
    indexer.startBackgroundIndexing().catch((e: Error) => {
      this.outputChannel.appendLine(`[MCP-InProcess] Indexing error: ${e.message}`);
    });

    this.outputChannel.appendLine("[MCP-InProcess] Engine initialization complete");

    // Return engine interface
    return {
      handleRequest: async (method: string, id: number, params: Record<string, unknown>) => {
        switch (method) {
          case "tools/list":
            return { jsonrpc: "2.0" as const, id, result: { tools: toolsMod.getToolDefinitions() } };
          case "tools/call": {
            const toolName = (params.name as string) ?? "";
            const toolArgs = (params.arguments as Record<string, unknown>) ?? {};
            if (memEngine) {
              const details = `${toolName}(${JSON.stringify(toolArgs).substring(0, 150)})`;
              memEngine.audit.log("TOOL_CALL", undefined, memEngine.getSessionId() ?? undefined, details);
            }
            const text = await toolsMod.dispatchTool(toolName, toolArgs, db, indexer, config.workspace);
            toolCallIngestMod.maybeIngestToolCall(toolName, toolArgs, text);

            // Emit SSE event for write operations
            if (this.sseConnections.size > 0) {
              const eventType = this.inferKbEvent(toolName, toolArgs);
              if (eventType) this.emitSseEvent(eventType, { tool: toolName, action: toolArgs.action });
            }

            return { jsonrpc: "2.0" as const, id, result: { content: [{ type: "text", text }] } };
          }
          case "initialize":
            return {
              jsonrpc: "2.0" as const, id,
              result: { protocolVersion: "2024-11-05", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "mcp-code-intelligence", version: "0.2.0" } },
            };
          case "ping":
            return { jsonrpc: "2.0" as const, id, result: {} };
          default:
            return { jsonrpc: "2.0" as const, id, error: { code: -32601, message: `Method not found: ${method}` } };
        }
      },
      cleanup: () => {
        if (orchEngine?.stop) orchEngine.stop();
        if (memEngine) memEngine.endSession();
      },
    };
  }

  // ─── Private: HTTP Server ──────────────────────────────────────────────────

  private startHttpServer(port: number, serverDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const viewerDir = path.join(serverDir, "viewer");

      const server = http.createServer(async (req, res) => {
        const url = new URL(req.url || "/", "http://localhost");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

        const p = url.pathname;
        try {
          if (p === "/mcp") { await this.handleMcpRequest(req, res); return; }
          if (p === "/health") { res.writeHead(200, { "Content-Type": "application/json" }); res.end('{"status":"ok","mode":"in-process"}'); return; }
          if (p === "/api/events") { this.handleSse(req, res); return; }
          if (p.startsWith("/api/")) { await this.handleViewerApi(url, res); return; }
          if (p === "/" || p === "/index.html") { this.serveFile(viewerDir, "index.html", res); return; }
          if (p === "/dashboard") { this.serveFile(viewerDir, "dashboard.html", res); return; }
          if (p === "/tags") { this.serveFile(viewerDir, "tags.html", res); return; }
          if (p === "/quality") { this.serveFile(viewerDir, "quality.html", res); return; }
          if (p === "/analytics") { this.serveFile(viewerDir, "analytics.html", res); return; }
          if (p.startsWith("/modules/") || p.startsWith("/config/")) { this.serveFile(viewerDir, p.slice(1), res); return; }
          if (p.match(/\.(js|css|png|svg|json)$/)) { this.serveFile(viewerDir, path.basename(p), res); return; }
          res.writeHead(404, { "Content-Type": "application/json" }); res.end('{"error":"Not found"}');
        } catch (err: unknown) {
          if (!res.headersSent) { res.writeHead(500, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: (err as Error).message })); }
        }
      });

      server.on("error", reject);
      server.listen(port, "127.0.0.1", () => {
        const addr = server.address() as net.AddressInfo;
        this._port = addr.port;
        this.httpServer = server;
        resolve();
      });
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
    if (!this.engine) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: jsonRpc.id, error: { code: -32002, message: "Engine not ready" } }));
      return;
    }
    const response = await this.engine.handleRequest(jsonRpc.method, jsonRpc.id, jsonRpc.params || {});
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(response));
  }

  private handleSse(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.writeHead(200, {
      "Content-Type": "text/event-stream", "Cache-Control": "no-cache",
      "Connection": "keep-alive", "Access-Control-Allow-Origin": "*", "X-Accel-Buffering": "no",
    });
    res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
    this.sseConnections.add(res);
    const keepalive = setInterval(() => { if (res.writable) res.write(": keepalive\n\n"); }, 30000);
    const cleanup = () => { clearInterval(keepalive); this.sseConnections.delete(res); };
    req.on("close", cleanup);
    req.on("error", cleanup);
    res.on("error", cleanup);
  }

  private async handleViewerApi(url: URL, res: http.ServerResponse): Promise<void> {
    const apiPath = url.pathname.replace("/api/", "");
    if (!this.engine) { res.writeHead(503, { "Content-Type": "application/json" }); res.end('{"error":"Engine not ready"}'); return; }
    try {
      if (apiPath === "memory/status" || apiPath === "kb/status") {
        const text = await this.callToolDirect("mem_admin", { action: "status" });
        const totalEntries = parseInt((text.match(/Total entries:\s*(\d+)/) || [])[1] || "0", 10);
        const totalEdges = parseInt((text.match(/Total edges:\s*(\d+)/) || [])[1] || "0", 10);
        const totalVectors = parseInt((text.match(/Total vectors:\s*(\d+)/) || [])[1] || "0", 10);
        this.sendJson(res, { totalEntries, totalEdges, totalVectors });
      } else if (apiPath === "memory/graph/data") {
        const limit = parseInt(url.searchParams.get("limit") || "15000", 10);
        const text = await this.callToolDirect("mem_graph", { action: "graph_data", limit });
        this.sendJson(res, JSON.parse(text));
      } else if (apiPath === "kb/dashboard") {
        this.sendJson(res, JSON.parse(await this.callToolDirect("mem_admin", { action: "dashboard" })));
      } else if (apiPath === "kb/tags") {
        this.sendJson(res, JSON.parse(await this.callToolDirect("mem_tags", { action: "taxonomy" })));
      } else if (apiPath === "memory/entries") {
        const limit = parseInt(url.searchParams.get("limit") || "20", 10);
        this.sendJson(res, JSON.parse(await this.callToolDirect("mem_crud", { action: "list", limit })));
      } else if (apiPath === "memory/search") {
        const q = url.searchParams.get("q") || "";
        const text = await this.callToolDirect("mem_search", { query: q, limit: 20, detail: true });
        try { this.sendJson(res, JSON.parse(text)); } catch { this.sendJson(res, []); }
      } else {
        res.writeHead(404, { "Content-Type": "application/json" }); res.end('{"error":"Not found"}');
      }
    } catch (err: unknown) {
      if (!res.headersSent) { res.writeHead(500, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: (err as Error).message })); }
    }
  }

  private async callToolDirect(name: string, args: Record<string, unknown>): Promise<string> {
    if (!this.engine) throw new Error("Engine not ready");
    const response = await this.engine.handleRequest("tools/call", ++this.requestId, { name, arguments: args });
    if (response?.error) throw new Error(response.error.message);
    const result = response?.result as { content?: Array<{ type: string; text: string }> } | undefined;
    const text = result?.content?.[0]?.text ?? "{}";
    if (text.startsWith("Unknown tool:")) throw new Error(text);
    return text;
  }

  // ─── Private: Utilities ────────────────────────────────────────────────────

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []; let size = 0; const MAX = 4 * 1024 * 1024;
      req.on("data", (c: Buffer) => { size += c.length; if (size > MAX) { reject(new Error("Body too large")); req.destroy(); return; } chunks.push(c); });
      req.on("end", () => resolve(Buffer.concat(chunks).toString()));
      req.on("error", reject);
    });
  }

  private sendJson(res: http.ServerResponse, data: unknown): void {
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(data));
  }

  private serveFile(viewerDir: string, relPath: string, res: http.ServerResponse): void {
    if (relPath.includes("..")) { res.writeHead(404); res.end(); return; }
    const filePath = path.join(viewerDir, relPath);
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('{"error":"Not found"}'); return; }
    const MIME: Record<string, string> = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": (MIME[ext] || "application/octet-stream") + "; charset=utf-8", "Cache-Control": "no-cache" });
    fs.createReadStream(filePath).pipe(res);
  }

  private emitSseEvent(eventType: string, data: Record<string, unknown>): void {
    const payload = JSON.stringify({ type: eventType, timestamp: Date.now(), data });
    for (const res of this.sseConnections) { if (res.writable) res.write(`event: ${eventType}\ndata: ${payload}\n\n`); }
  }

  private inferKbEvent(toolName: string, args: Record<string, unknown>): string | null {
    switch (toolName) {
      case "mem_ingest": case "mem_ingest_file": return "kb_entry_added";
      case "mem_crud": return args?.action === "delete" ? "kb_entry_deleted" : args?.action === "update" ? "kb_entry_updated" : null;
      case "mem_tags": { const a = args?.action; return a === "create" ? "tag_created" : a === "delete" ? "tag_deleted" : (a === "tag" || a === "untag") ? "tag_updated" : null; }
      case "mem_consolidate": return "consolidation_complete";
      default: return null;
    }
  }

  private async invokeToolViaHttp(name: string, args: Record<string, unknown>): Promise<string> {
    const request: McpRequest = { jsonrpc: "2.0", id: ++this.requestId, method: "tools/call", params: { name, arguments: args } };
    const url = `http://127.0.0.1:${this._port}/mcp`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SERVER_CONSTANTS.REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request), signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as McpResponse;
      if (data.error) throw new Error(`MCP error (${data.error.code}): ${data.error.message}`);
      return data.result?.content?.[0]?.text ?? "";
    } catch (err: unknown) { clearTimeout(timeout); if ((err as Error).name === "AbortError") throw new McpTimeoutError(name, SERVER_CONSTANTS.REQUEST_TIMEOUT_MS); throw err; }
  }

  private setStatus(status: ServerStatus): void {
    if (this._status !== status) { this._status = status; this._onStatusChange.fire(status); }
  }

  private getConfiguredPort(): number {
    return vscode.workspace.getConfiguration("kiroSdlc").get<number>("mcpServerPort", 9181);
  }

  private isPortListening(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(2000);
      socket.on("connect", () => { socket.destroy(); resolve(true); });
      socket.on("timeout", () => { socket.destroy(); resolve(false); });
      socket.on("error", () => { socket.destroy(); resolve(false); });
      socket.connect(port, "127.0.0.1");
    });
  }

  private updateMcpJson(): void {
    if (!this._port) return;
    try {
      const mcpDir = path.join(this.workspaceFolder, ".kiro", "settings");
      const mcpPath = path.join(mcpDir, "mcp.json");
      let config: Record<string, unknown> = {};
      if (fs.existsSync(mcpPath)) { config = JSON.parse(fs.readFileSync(mcpPath, "utf-8")); }
      else { if (!fs.existsSync(mcpDir)) fs.mkdirSync(mcpDir, { recursive: true }); }
      const servers = (config.mcpServers as Record<string, unknown>) || {};
      const existing = (servers["code-intelligence"] as Record<string, unknown>) || {};
      servers["code-intelligence"] = { ...existing, type: "httpStream", url: `http://127.0.0.1:${this._port}/mcp` };
      config.mcpServers = servers;
      fs.writeFileSync(mcpPath, JSON.stringify(config, null, 2), "utf-8");
      this.outputChannel.appendLine(`[MCP-InProcess] Updated mcp.json → http://127.0.0.1:${this._port}/mcp`);
    } catch (err) { this.outputChannel.appendLine(`[MCP-InProcess] Warning: could not update mcp.json: ${(err as Error).message}`); }
  }
}
