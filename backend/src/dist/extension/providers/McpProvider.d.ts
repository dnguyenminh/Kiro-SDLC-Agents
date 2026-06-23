/**
 * McpProvider — MCP resource discovery
 * KSA-252
 */
import type { McpResourceItem } from '../../shared/protocol';
interface ExtensionContext {
    getMcpResources(): Array<{
        server: string;
        name: string;
        type: string;
        description?: string;
    }>;
}
export declare class McpProvider {
    private context;
    constructor(context: ExtensionContext);
    getResources(): Promise<McpResourceItem[]>;
    getResourceContent(server: string, resource: string): Promise<string>;
}
export {};
//# sourceMappingURL=McpProvider.d.ts.map