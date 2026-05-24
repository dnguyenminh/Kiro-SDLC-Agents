/**
 * JSON-RPC 2.0 over stdio pipes — sends requests to child process stdin,
 * reads responses from child process stdout.
 * Behavioral parity with Kotlin StdioJsonRpc.kt.
 */
import { ChildProcess } from 'child_process';
export declare class StdioJsonRpc {
    private nextId;
    private pending;
    private proc;
    private rl;
    /** Attach to a child process's stdin/stdout. Starts reader. */
    attach(proc: ChildProcess): void;
    /** Detach from process — close reader, reject pending. */
    detach(): void;
    /** Send JSON-RPC request and await response with timeout. */
    sendRequest(method: string, params: any, timeoutMs: number): Promise<any>;
    /** Send JSON-RPC notification (no response expected). */
    sendNotification(method: string, params: any): void;
    /** Reject all pending requests. */
    rejectAll(reason: string): void;
    private handleIncoming;
    private resolveResponse;
    private writeMessage;
}
//# sourceMappingURL=rpc.d.ts.map