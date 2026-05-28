"use strict";
/**
 * httpStream MCP server process — connects to upstream MCP server via HTTP POST.
 * Same state machine as ServerProcess (stdio), but no child process spawning.
 * Behavioral parity with Kotlin HttpStreamProcess.kt.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpStreamProcess = void 0;
const process_js_1 = require("./process.js");
const http_json_rpc_js_1 = require("./http-json-rpc.js");
class HttpStreamProcess {
    name;
    state = process_js_1.ServerState.STARTING;
    tools = [];
    retryCount = 0;
    rpc;
    entry;
    constructor(name, entry) {
        this.name = name;
        this.entry = entry;
        this.rpc = new http_json_rpc_js_1.HttpJsonRpc(entry.url);
    }
    /** Connect to httpStream server, initialize MCP handshake, fetch tools. */
    async start() {
        this.state = process_js_1.ServerState.STARTING;
        this.log(`Connecting to ${this.entry.url}`);
        if (!await this.initialize())
            return this.markFailed(`Initialize handshake failed at ${this.entry.url}`);
        this.state = process_js_1.ServerState.READY;
        if (!await this.fetchTools())
            return this.markFailed('Failed to fetch tools');
        this.state = process_js_1.ServerState.ACTIVE;
        this.log(`Active with ${this.tools.length} tools`);
        return true;
    }
    /** Stop — no process to kill, just mark dead. */
    stop() {
        this.state = process_js_1.ServerState.DEAD;
        this.log('Stopped');
    }
    /** Restart — re-create RPC client and re-initialize. */
    async restart(maxRetries) {
        if (this.retryCount >= maxRetries) {
            this.state = process_js_1.ServerState.DEAD;
            return false;
        }
        this.state = process_js_1.ServerState.RESTARTING;
        this.retryCount++;
        const backoffMs = Math.min(1000 * this.retryCount, 10_000);
        this.log(`Restarting (attempt ${this.retryCount}/${maxRetries}, backoff ${backoffMs}ms)`);
        await new Promise((r) => setTimeout(r, backoffMs));
        // Re-create RPC client (fresh session)
        this.rpc = new http_json_rpc_js_1.HttpJsonRpc(this.entry.url);
        return this.start();
    }
    /** Call a tool on this httpStream server via HTTP POST. */
    async callTool(toolName, args, timeoutMs) {
        return this.rpc.sendRequest('tools/call', { name: toolName, arguments: args }, timeoutMs);
    }
    /** Health check — send tools/list via HTTP, expect response within 5s. */
    async healthCheck() {
        try {
            await this.rpc.sendRequest('tools/list', {}, 5_000);
            return true;
        }
        catch {
            return false;
        }
    }
    /** No OS process — alive means state is ACTIVE. */
    isAlive() { return this.state === process_js_1.ServerState.ACTIVE; }
    async initialize() {
        const params = {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'mcp-orchestrator', version: '1.0.0' },
        };
        try {
            await this.rpc.sendRequest('initialize', params, this.entry.timeout);
            this.rpc.sendNotification('notifications/initialized', {});
            return true;
        }
        catch (e) {
            this.log(`Initialize failed: ${e.message}`);
            return false;
        }
    }
    async fetchTools() {
        try {
            const result = await this.rpc.sendRequest('tools/list', {}, this.entry.timeout);
            this.tools = result?.tools ?? [];
            return true;
        }
        catch (e) {
            this.log(`Fetch tools failed: ${e.message}`);
            return false;
        }
    }
    markFailed(reason) {
        this.log(reason);
        this.state = process_js_1.ServerState.FAILED;
        return false;
    }
    log(msg) { console.error(`[${this.name}] ${msg}`); }
}
exports.HttpStreamProcess = HttpStreamProcess;
//# sourceMappingURL=http-stream-process.js.map