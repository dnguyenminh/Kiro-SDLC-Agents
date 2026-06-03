"use strict";
/**
 * Base MCP server implementation using stdio JSON-RPC 2.0 transport.
 * All 3 servers (sf-parser, sf-graph, sf-kb-indexer) extend this class.
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
exports.ServerBase = void 0;
const readline = __importStar(require("readline"));
const errors_js_1 = require("./errors.js");
const PROTOCOL_VERSION = '2024-11-05';
class ServerBase {
    serverName;
    tools;
    workspace = '';
    constructor(serverName, tools) {
        this.serverName = serverName;
        this.tools = tools;
    }
    async start() {
        console.error(`[${this.serverName}] Starting (workspace deferred until initialize)`);
        const rl = readline.createInterface({ input: process.stdin, terminal: false });
        for await (const line of rl) {
            if (!line.trim())
                continue;
            let request;
            try {
                request = JSON.parse(line);
            }
            catch {
                this.send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
                continue;
            }
            const { method, id, params } = request;
            // Skip notifications (no id)
            if (id === null && method?.startsWith('notifications/'))
                continue;
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
                }
                catch (err) {
                    if (err instanceof errors_js_1.SfToolError) {
                        this.send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: err.toJSON() }] } });
                    }
                    else {
                        console.error(`[${this.serverName}] Unexpected error:`, err);
                        const msg = JSON.stringify({ error: 'INTERNAL', message: `Internal error: ${err.message}` });
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
    /** Override in subclass for post-initialize setup */
    async onInitialize() { }
    extractRootUri(params) {
        const roots = params?.roots;
        if (Array.isArray(roots) && roots.length > 0 && roots[0]?.uri) {
            const uri = roots[0].uri;
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
    buildInitResult() {
        return {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: this.serverName, version: '1.0.0' },
        };
    }
    send(response) {
        process.stdout.write(JSON.stringify(response) + '\n');
    }
}
exports.ServerBase = ServerBase;
//# sourceMappingURL=server-base.js.map