/**
 * Local server manager — manages multiple child MCP server processes.
 * Behavioral parity with Kotlin LocalServerManager.kt.
 */
import { OrchestrationConfig } from '../config.js';
import { ServerState } from './process.js';
export declare class LocalServerManager {
    private config;
    private servers;
    private healthInterval;
    constructor(config: OrchestrationConfig);
    updateConfig(newConfig: OrchestrationConfig): void;
    /** Start all enabled servers. Returns count of successfully started. */
    startAll(): Promise<number>;
    /** Stop all child servers gracefully. */
    stopAll(): void;
    /** Call a tool on the specified server. */
    callTool(serverName: string, toolName: string, args: Record<string, any>, timeoutMs: number): Promise<any>;
    /** Find which server owns a given tool name. */
    findServerForTool(toolName: string): string | null;
    /** Get all tools from all active child servers. */
    getAllTools(): Array<[string, Record<string, any>]>;
    /** Get status of all managed servers. */
    getStatus(): Map<string, ServerState>;
    /** Get detailed status info. */
    getServerStatusInfo(): Array<{
        name: string;
        state: string;
        toolCount: number;
    }>;
    private startHealthMonitor;
    /** Retry starting servers that are in FAILED state. Returns names of recovered servers. */
    retryFailedServers(): Promise<string[]>;
    private checkHealth;
}
//# sourceMappingURL=manager.d.ts.map