"use strict";
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
exports.RemoteBackendClient = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
const zod_1 = require("zod");
class RemoteBackendClient {
    workspaceFolder;
    outputChannel;
    authManager;
    backendUrl;
    _status = "stopped";
    _port = null;
    _wrapperPort = null;
    _onStatusChange = new vscode.EventEmitter();
    onStatusChange = this._onStatusChange.event;
    mcpClient = null;
    httpServer = null;
    requestId = 0;
    _onNotification = new vscode.EventEmitter();
    onNotification = this._onNotification.event;
    constructor(workspaceFolder, outputChannel, authManager, backendUrl) {
        this.workspaceFolder = workspaceFolder;
        this.outputChannel = outputChannel;
        this.authManager = authManager;
        this.backendUrl = backendUrl;
        this._port = this.extractPort(backendUrl);
    }
    get status() {
        return this._status;
    }
    get port() {
        return this._wrapperPort || this._port;
    }
    extractPort(url) {
        try {
            const parsed = new URL(url);
            if (parsed.port)
                return parseInt(parsed.port, 10);
            return parsed.protocol === "https:" ? 443 : 80;
        }
        catch {
            return null;
        }
    }
    setStatus(status) {
        if (this._status !== status) {
            this._status = status;
            this._onStatusChange.fire(status);
        }
    }
    async connect() {
        this.setStatus("starting");
        try {
            // Health check
            await this.checkHealth();
            this.mcpClient = new index_js_1.Client({
                name: "kiro-sdlc-extension",
                version: "2.0.0"
            }, { capabilities: {} });
            // Handle all generic notifications and proxy them
            this.mcpClient.fallbackNotificationHandler = async (notification) => {
                this._onNotification.fire({ method: notification.method, params: notification.params });
            };
            const url = new URL(`${this.backendUrl}/mcp`);
            const token = this.authManager?.getTokenSync();
            const requestInit = {};
            if (token) {
                requestInit.headers = {
                    "Authorization": `Bearer ${token}`
                };
            }
            // Use the StreamableHTTPClientTransport matching the WebStandardStreamableHTTPServerTransport in backend
            const transport = new streamableHttp_js_1.StreamableHTTPClientTransport(url, {
                requestInit
            });
            await this.mcpClient.connect(transport);
            await this.startLocalServer();
            this.setStatus("running");
            this.outputChannel.appendLine(`[RemoteBackendClient] Connected to ${this.backendUrl} via MCP Streamable Transport`);
        }
        catch (err) {
            this.setStatus("crashed");
            this.outputChannel.appendLine(`[RemoteBackendClient] Connection failed: ${err.message}`);
            throw err;
        }
    }
    async startLocalServer() {
        const config = vscode.workspace.getConfiguration("kiroSdlc");
        const port = config.get("mcpServerPort", 9181);
        return new Promise((resolve, reject) => {
            const server = http.createServer(async (req, res) => {
                const url = new URL(req.url || "/", "http://localhost");
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                res.setHeader("Access-Control-Allow-Headers", "Content-Type");
                if (req.method === "OPTIONS") {
                    res.writeHead(204);
                    res.end();
                    return;
                }
                const p = url.pathname;
                try {
                    if (p === "/mcp") {
                        await this.handleMcpRequest(req, res);
                        return;
                    }
                    // Dummy endpoints for legacy UI compatibility
                    if (p === "/health") {
                        res.writeHead(200, { "Content-Type": "application/json" });
                        res.end('{"status":"ok","mode":"wrapper"}');
                        return;
                    }
                    res.writeHead(404, { "Content-Type": "application/json" });
                    res.end('{"error":"Not found"}');
                }
                catch (err) {
                    if (!res.headersSent) {
                        res.writeHead(500, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ error: err.message }));
                    }
                }
            });
            server.on("error", reject);
            server.listen(port, "127.0.0.1", () => {
                const addr = server.address();
                this._wrapperPort = addr.port;
                this.httpServer = server;
                this.outputChannel.appendLine(`[WrapperServer] Listening on local port ${this._wrapperPort}`);
                resolve();
            });
        });
    }
    readBody(req) {
        return new Promise((resolve, reject) => {
            let body = "";
            req.on("data", chunk => body += chunk.toString());
            req.on("end", () => resolve(body));
            req.on("error", reject);
        });
    }
    async handleMcpRequest(req, res) {
        if (req.method !== "POST") {
            res.writeHead(405, { Allow: "POST" });
            res.end('{"error":"Method not allowed"}');
            return;
        }
        const body = await this.readBody(req);
        let jsonRpc;
        try {
            jsonRpc = JSON.parse(body);
        }
        catch {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end('{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error"}}');
            return;
        }
        if (jsonRpc.id === undefined)
            jsonRpc.id = ++this.requestId;
        if (!this.mcpClient) {
            res.writeHead(503, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ jsonrpc: "2.0", id: jsonRpc.id, error: { code: -32002, message: "Backend not connected" } }));
            return;
        }
        try {
            // Custom interception for tool calls
            if (jsonRpc.method === "tools/call" && jsonRpc.params) {
                const name = jsonRpc.params.name;
                const args = (jsonRpc.params.arguments || {});
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
            const response = await this.mcpClient.request({ method: jsonRpc.method, params: jsonRpc.params }, zod_1.z.any());
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ jsonrpc: "2.0", id: jsonRpc.id, result: response }));
        }
        catch (err) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ jsonrpc: "2.0", id: jsonRpc.id, error: { code: err.code || -32603, message: err.message } }));
        }
    }
    async disconnect() {
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
    async reconnect() {
        await this.disconnect();
        await this.connect();
    }
    async checkHealth() {
        // Simple HTTP GET to backend to ensure it's up
        return new Promise((resolve, reject) => {
            const req = (this.backendUrl.startsWith("https") ? https : http).get(`${this.backendUrl}/health`, (res) => {
                if (res.statusCode === 200) {
                    resolve();
                }
                else {
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
    async invokeTool(name, args) {
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
    async wrapToolArguments(name, args) {
        const newArgs = { ...args };
        if (name === "mem_ingest_file") {
            const filePath = args.file_path;
            if (filePath) {
                try {
                    const content = fs.readFileSync(filePath, "utf-8");
                    newArgs.content = content;
                }
                catch (err) {
                    throw new Error(`Wrapper failed to read local file ${filePath}: ${err.message}`);
                }
            }
        }
        return newArgs;
    }
    /**
     * Execute local tools that shouldn't be forwarded to the backend.
     */
    async executeLocalTool(name, args) {
        if (name === "stream_write_file") {
            const filePath = args.path;
            const content = args.content;
            const mode = args.mode || "write";
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
                }
                else {
                    fs.writeFileSync(filePath, content, "utf-8");
                    return { isError: false, content: [{ type: "text", text: `Successfully wrote file: ${filePath}` }] };
                }
            }
            catch (err) {
                return { isError: true, content: [{ type: "text", text: `Failed to write file ${filePath}: ${err.message}` }] };
            }
        }
        // Fallback for embed_image or other local tools if needed
        return { isError: true, content: [{ type: "text", text: `Local tool '${name}' is intercepted but not fully implemented in wrapper yet.` }] };
    }
    dispose() {
        this.disconnect().catch(() => { });
        this._onNotification.dispose();
        this._onStatusChange.dispose();
    }
}
exports.RemoteBackendClient = RemoteBackendClient;
//# sourceMappingURL=remote-backend-client.js.map