/**
 * Base MCP server implementation using stdio JSON-RPC 2.0 transport.
 * All 3 servers (sf-parser, sf-graph, sf-kb-indexer) extend this class.
 */
import type { ToolDefinition } from './types.js';
export declare abstract class ServerBase {
    protected readonly serverName: string;
    protected readonly tools: ToolDefinition[];
    protected workspace: string;
    constructor(serverName: string, tools: ToolDefinition[]);
    start(): Promise<void>;
    protected abstract dispatchTool(name: string, args: Record<string, unknown>): Promise<string>;
    /** Override in subclass for post-initialize setup */
    protected onInitialize(): Promise<void>;
    protected extractRootUri(params: any): string | null;
    private buildInitResult;
    protected send(response: any): void;
}
//# sourceMappingURL=server-base.d.ts.map