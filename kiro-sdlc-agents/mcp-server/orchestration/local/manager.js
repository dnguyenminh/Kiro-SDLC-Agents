"use strict";
/**
 * Local server manager — manages multiple child MCP server processes.
 * Behavioral parity with Kotlin LocalServerManager.kt.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalServerManager = void 0;
const config_js_1 = require("../config.js");
const process_js_1 = require("./process.js");
class LocalServerManager {
    config;
    servers = new Map();
    healthInterval = null;
    constructor(config) { this.config = config; }
    updateConfig(newConfig) { this.config = newConfig; }
    /** Start all enabled servers. Returns count of successfully started. */
    async startAll() {
        const entries = (0, config_js_1.enabledServers)(this.config);
        console.error(`[orchestration] Starting ${entries.size} child servers...`);
        let started = 0;
        for (const [name, entry] of entries) {
            const server = new process_js_1.ServerProcess(name, entry);
            this.servers.set(name, server);
            if (await server.start())
                started++;
            else
                console.error(`[${name}] Failed to start`);
        }
        this.startHealthMonitor();
        return started;
    }
    /** Stop all child servers gracefully. */
    stopAll() {
        if (this.healthInterval) {
            clearInterval(this.healthInterval);
            this.healthInterval = null;
        }
        for (const server of this.servers.values())
            server.stop();
        this.servers.clear();
        console.error('[orchestration] All child servers stopped');
    }
    /** Call a tool on the specified server. */
    async callTool(serverName, toolName, args, timeoutMs) {
        const server = this.servers.get(serverName);
        if (!server)
            throw new Error(`Server '${serverName}' not found (tool: '${toolName}')`);
        if (server.state !== process_js_1.ServerState.ACTIVE)
            throw new Error(`Server '${serverName}' is ${server.state}`);
        return server.callTool(toolName, args, timeoutMs);
    }
    /** Find which server owns a given tool name. */
    findServerForTool(toolName) {
        for (const [name, server] of this.servers) {
            if (server.state !== process_js_1.ServerState.ACTIVE)
                continue;
            if (server.tools.some((t) => t.name === toolName))
                return name;
        }
        return null;
    }
    /** Get all tools from all active child servers. */
    getAllTools() {
        const result = [];
        for (const [name, server] of this.servers) {
            if (server.state === process_js_1.ServerState.ACTIVE) {
                for (const tool of server.tools)
                    result.push([name, tool]);
            }
        }
        return result;
    }
    /** Get status of all managed servers. */
    getStatus() {
        const result = new Map();
        for (const [name, server] of this.servers)
            result.set(name, server.state);
        return result;
    }
    /** Get detailed status info. */
    getServerStatusInfo() {
        return [...this.servers.entries()].map(([name, s]) => ({
            name, state: s.state, toolCount: s.tools.length,
        }));
    }
    startHealthMonitor() {
        const intervalMs = this.config.settings.healthCheckIntervalMs;
        this.healthInterval = setInterval(() => this.checkHealth(), intervalMs);
    }
    /** Retry starting servers that are in FAILED state. Returns names of recovered servers. */
    async retryFailedServers() {
        const recovered = [];
        for (const [name, server] of this.servers) {
            if (server.state !== process_js_1.ServerState.FAILED)
                continue;
            console.error(`[${name}] Retrying failed server...`);
            if (await server.start()) {
                recovered.push(name);
                console.error(`[${name}] Recovered — now active with ${server.tools.length} tools`);
            }
            else {
                console.error(`[${name}] Still failing`);
            }
        }
        return recovered;
    }
    async checkHealth() {
        for (const [name, server] of this.servers) {
            if (server.state === process_js_1.ServerState.FAILED) {
                console.error(`[${name}] Health check: retrying failed server`);
                if (await server.start()) {
                    console.error(`[${name}] Recovered via health check`);
                }
                continue;
            }
            if (server.state !== process_js_1.ServerState.ACTIVE)
                continue;
            if (!server.isAlive() || !await server.healthCheck()) {
                console.error(`[${name}] Unhealthy — attempting restart`);
                const maxRetries = this.config.settings.maxRestartRetries;
                if (!await server.restart(maxRetries)) {
                    console.error(`[${name}] Permanently dead after ${maxRetries} retries`);
                }
            }
        }
    }
}
exports.LocalServerManager = LocalServerManager;
//# sourceMappingURL=manager.js.map