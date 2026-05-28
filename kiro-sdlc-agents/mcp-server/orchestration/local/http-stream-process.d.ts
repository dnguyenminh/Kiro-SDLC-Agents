/**
 * httpStream MCP server process — connects to upstream MCP server via HTTP POST.
 * Same state machine as ServerProcess (stdio), but no child process spawning.
 * Behavioral parity with Kotlin HttpStreamProcess.kt.
 */
import { ServerEntry } from '../config.js';
import { ServerState } from './process.js';
import { IServerProcess } from './transport.js';
export declare class HttpStreamProcess implements IServerProcess {
    readonly name: string;
    state: ServerState;
    tools: Record<string, any>[];
    retryCount: number;
    private rpc;
    private entry;
    constructor(name: string, entry: ServerEntry);
    /** Connect to httpStream server, initialize MCP handshake, fetch tools. */
    start(): Promise<boolean>;
    /** Stop — no process to kill, just mark dead. */
    stop(): void;
    /** Restart — re-create RPC client and re-initialize. */
    restart(maxRetries: number): Promise<boolean>;
    /** Call a tool on this httpStream server via HTTP POST. */
    callTool(toolName: string, args: Record<string, any>, timeoutMs: number): Promise<any>;
    /** Health check — send tools/list via HTTP, expect response within 5s. */
    healthCheck(): Promise<boolean>;
    /** No OS process — alive means state is ACTIVE. */
    isAlive(): boolean;
    private initialize;
    private fetchTools;
    private markFailed;
    private log;
}
//# sourceMappingURL=http-stream-process.d.ts.map