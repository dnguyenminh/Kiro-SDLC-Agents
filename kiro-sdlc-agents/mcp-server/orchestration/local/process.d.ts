/**
 * Single child MCP server process lifecycle — spawn, initialize, fetch tools, health check.
 * State machine: STARTING → READY → ACTIVE → CRASHED → RESTARTING → DEAD.
 * Behavioral parity with Kotlin ServerProcess.kt.
 */
import { ServerEntry } from '../config.js';
import { StdioJsonRpc } from './rpc.js';
export declare enum ServerState {
    STARTING = "STARTING",
    READY = "READY",
    ACTIVE = "ACTIVE",
    CRASHED = "CRASHED",
    RESTARTING = "RESTARTING",
    STOPPING = "STOPPING",
    DEAD = "DEAD",
    FAILED = "FAILED"
}
export declare class ServerProcess {
    readonly name: string;
    state: ServerState;
    tools: Record<string, any>[];
    retryCount: number;
    readonly rpc: StdioJsonRpc;
    private proc;
    private entry;
    constructor(name: string, entry: ServerEntry);
    /** Start child process, initialize MCP handshake, fetch tools. */
    start(): Promise<boolean>;
    /** Stop child process gracefully. */
    stop(): void;
    /** Restart after crash with exponential backoff. */
    restart(maxRetries: number): Promise<boolean>;
    /** Call a tool on this child server via JSON-RPC. */
    callTool(toolName: string, args: Record<string, any>, timeoutMs: number): Promise<any>;
    /** Health check — send tools/list, expect response within 5s. */
    healthCheck(): Promise<boolean>;
    /** Check if OS process is still alive. */
    isAlive(): boolean;
    private spawnProcess;
    private initialize;
    private fetchTools;
    private destroyProcess;
    private tryWindowsTreeKill;
    private markFailed;
    private log;
}
//# sourceMappingURL=process.d.ts.map