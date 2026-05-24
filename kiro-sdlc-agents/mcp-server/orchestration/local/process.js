"use strict";
/**
 * Single child MCP server process lifecycle — spawn, initialize, fetch tools, health check.
 * State machine: STARTING → READY → ACTIVE → CRASHED → RESTARTING → DEAD.
 * Behavioral parity with Kotlin ServerProcess.kt.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerProcess = exports.ServerState = void 0;
const child_process_1 = require("child_process");
const rpc_js_1 = require("./rpc.js");
var ServerState;
(function (ServerState) {
    ServerState["STARTING"] = "STARTING";
    ServerState["READY"] = "READY";
    ServerState["ACTIVE"] = "ACTIVE";
    ServerState["CRASHED"] = "CRASHED";
    ServerState["RESTARTING"] = "RESTARTING";
    ServerState["STOPPING"] = "STOPPING";
    ServerState["DEAD"] = "DEAD";
    ServerState["FAILED"] = "FAILED";
})(ServerState || (exports.ServerState = ServerState = {}));
class ServerProcess {
    name;
    state = ServerState.STARTING;
    tools = [];
    retryCount = 0;
    rpc = new rpc_js_1.StdioJsonRpc();
    proc = null;
    entry;
    constructor(name, entry) {
        this.name = name;
        this.entry = entry;
    }
    /** Start child process, initialize MCP handshake, fetch tools. */
    async start() {
        this.state = ServerState.STARTING;
        const proc = this.spawnProcess();
        if (!proc)
            return this.markFailed('Failed to spawn process');
        this.proc = proc;
        this.rpc.attach(proc);
        if (!await this.initialize())
            return this.markFailed('Initialize handshake failed');
        this.state = ServerState.READY;
        if (!await this.fetchTools())
            return this.markFailed('Failed to fetch tools');
        this.state = ServerState.ACTIVE;
        this.log(`Active with ${this.tools.length} tools`);
        return true;
    }
    /** Stop child process gracefully. */
    stop() {
        this.state = ServerState.STOPPING;
        this.rpc.detach();
        this.destroyProcess();
        this.state = ServerState.DEAD;
        this.log('Stopped');
    }
    /** Restart after crash with exponential backoff. */
    async restart(maxRetries) {
        if (this.retryCount >= maxRetries) {
            this.state = ServerState.DEAD;
            return false;
        }
        this.state = ServerState.RESTARTING;
        this.retryCount++;
        const backoffMs = Math.min(1000 * this.retryCount, 10_000);
        this.log(`Restarting (attempt ${this.retryCount}/${maxRetries}, backoff ${backoffMs}ms)`);
        await new Promise((r) => setTimeout(r, backoffMs));
        this.destroyProcess();
        return this.start();
    }
    /** Call a tool on this child server via JSON-RPC. */
    async callTool(toolName, args, timeoutMs) {
        return this.rpc.sendRequest('tools/call', { name: toolName, arguments: args }, timeoutMs);
    }
    /** Health check — send tools/list, expect response within 5s. */
    async healthCheck() {
        try {
            await this.rpc.sendRequest('tools/list', {}, 5_000);
            return true;
        }
        catch {
            return false;
        }
    }
    /** Check if OS process is still alive. */
    isAlive() { return this.proc !== null && this.proc.exitCode === null; }
    spawnProcess() {
        try {
            const isWin = process.platform === 'win32';
            return (0, child_process_1.spawn)(this.entry.command, this.entry.args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env, ...this.entry.env },
                shell: isWin,
            });
        }
        catch (e) {
            this.log(`Spawn failed: ${e.message}`);
            return null;
        }
    }
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
    destroyProcess() {
        const proc = this.proc;
        if (!proc)
            return;
        if (proc.exitCode === null) {
            if (!this.tryWindowsTreeKill(proc))
                proc.kill('SIGKILL');
        }
        this.proc = null;
    }
    tryWindowsTreeKill(proc) {
        if (process.platform !== 'win32')
            return false;
        try {
            (0, child_process_1.execSync)(`taskkill /T /F /PID ${proc.pid}`, { timeout: 3000 });
            return true;
        }
        catch {
            return false;
        }
    }
    markFailed(reason) {
        this.log(reason);
        this.state = ServerState.FAILED;
        return false;
    }
    log(msg) { console.error(`[${this.name}] ${msg}`); }
}
exports.ServerProcess = ServerProcess;
//# sourceMappingURL=process.js.map