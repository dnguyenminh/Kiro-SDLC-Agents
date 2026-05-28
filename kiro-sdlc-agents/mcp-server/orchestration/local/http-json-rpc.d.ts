/**
 * JSON-RPC 2.0 over HTTP POST — sends requests to upstream httpStream MCP servers.
 * Handles both JSON and SSE response formats.
 * Manages Mcp-Session-Id header automatically.
 */
export declare class HttpJsonRpc {
    private url;
    private sessionId;
    private nextId;
    constructor(url: string);
    /** Send JSON-RPC request via HTTP POST and await response with timeout. */
    sendRequest(method: string, params: any, timeoutMs: number): Promise<any>;
    /** Send JSON-RPC notification (fire-and-forget, no response expected). */
    sendNotification(method: string, params: any): void;
    /** Parse SSE response — extract last data line containing JSON-RPC result. */
    private parseSSE;
}
//# sourceMappingURL=http-json-rpc.d.ts.map